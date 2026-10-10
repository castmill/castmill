import {
  playVideo,
  type PlayerRuntimeError,
  type VideoPlaybackController,
  type VideoPlaybackControllerFactory,
} from '@castmill/player';
import { Logger } from '../utils/log';
import { isWebosNativeUrl } from './webos-legacy-file-storage';

type VideoElement = Pick<
  HTMLVideoElement,
  | 'readyState'
  | 'ended'
  | 'currentTime'
  | 'error'
  | 'src'
  | 'paused'
  | 'networkState'
  | 'videoWidth'
  | 'videoHeight'
  | 'load'
  | 'play'
  | 'pause'
  | 'addEventListener'
  | 'removeEventListener'
  | 'getAttribute'
  | 'removeAttribute'
>;

interface PlaybackRequest {
  offset: number;
  play: boolean;
  reload?: boolean;
}

const METADATA_TIMEOUT_MS = 15_000;
const METADATA_RETRY_DELAY_MS = 30_000;
const RESTART_DEFER_MS = 250;
// Only defer backward jumps to the start of a video that has visibly advanced;
// the timeline wrap can arrive with an offset of tens of milliseconds.
const RESTART_DEFER_MAX_OFFSET_MS = 1000;
const RESTART_DEFER_MIN_JUMP_MS = 1000;
const PROGRESS_CHECK_MS = 500;
const NO_PROGRESS_MS = 2000;
// A stall this close to the end is the video finishing, not a lost decoder.
const STALL_END_MARGIN_SECONDS = 0.5;
// Readiness and seek progress are logged by the controller itself; `stalled`
// and the canplay family fire routinely on WebOS without indicating a problem.
const MEDIA_EVENTS = [
  'loadstart',
  'loadedmetadata',
  'playing',
  'waiting',
  'seeked',
  'ended',
  'error',
];
const INITIAL_LOAD_EVENTS = ['loadedmetadata', 'loadeddata', 'canplay'];
// LG webOS Signage supports gapless playback with two video tags; more loaded
// tags compete for the hardware decoders and can freeze the visible video.
// Applies to all WebOS models for now; some models may need a lower limit.
export const MAX_LOADED_VIDEOS = 2;
const PARKED_RETRY_MS = 1000;
let nextVideoId = 0;

// Tracks which WebOS videos hold a media source so at most `limit` keep a
// decoder. Paused videos that were claimed least recently are released first,
// preferring videos that are no longer attached to the document. Playing and
// loading videos are never released: a video that cannot get a decoder waits
// in a queue, marked as blocked, until a holder pauses or finishes
// loading. Play requests are served first, then larger videos, then FIFO.
// Queued videos of layers that are no longer in the document are skipped.
export class WebosDecoderBudget {
  private holders: WebosVideoPlayback[] = [];
  private waiters: WebosVideoPlayback[] = [];
  private draining = false;
  private parkedRetryTimer?: ReturnType<typeof setTimeout>;
  private drainRequested = false;

  constructor(private readonly limit = MAX_LOADED_VIDEOS) {}

  get size(): number {
    return this.holders.length;
  }

  get capacity(): number {
    return this.limit;
  }

  get waiting(): number {
    return this.waiters.length;
  }

  // Returns true when the controller holds a decoder. Otherwise it is queued
  // and receives grantDecoder() once a decoder is available.
  claim(controller: WebosVideoPlayback): boolean {
    const index = this.holders.indexOf(controller);
    if (index >= 0) {
      this.holders.splice(index, 1);
      this.holders.push(controller);
      return true;
    }
    // Releasing holders must not hand their decoders to queued videos first.
    const draining = this.draining;
    this.draining = true;
    let room: boolean;
    try {
      room = this.makeRoom(controller, controller.isPlayRequested());
    } finally {
      this.draining = draining;
    }
    if (!room) {
      if (this.waiters.indexOf(controller) < 0) this.waiters.push(controller);
      return false;
    }
    this.cancel(controller);
    this.holders.push(controller);
    return true;
  }

  cancel(controller: WebosVideoPlayback): void {
    const index = this.waiters.indexOf(controller);
    if (index >= 0) this.waiters.splice(index, 1);
  }

  remove(controller: WebosVideoPlayback): void {
    this.cancel(controller);
    const index = this.holders.indexOf(controller);
    if (index < 0) return;
    this.holders.splice(index, 1);
    this.drain();
  }

  // Hands free or releasable decoders to queued videos. Holders call this
  // when they pause or finish loading.
  drain(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      for (;;) {
        const waiter = this.nextWaiter();
        if (!waiter) break;
        if (!this.makeRoom(waiter, waiter.isPlayRequested())) break;
        this.cancel(waiter);
        this.holders.push(waiter);
        waiter.grantDecoder();
      }
    } finally {
      this.draining = false;
    }
    this.scheduleParkedRetry();
  }

  requestDrain(): void {
    if (this.drainRequested) return;
    this.drainRequested = true;
    void Promise.resolve().then(() => {
      this.drainRequested = false;
      this.drain();
    });
  }

  clear(): void {
    this.holders = [];
    this.waiters = [];
    clearTimeout(this.parkedRetryTimer);
    this.parkedRetryTimer = undefined;
  }

  // A waiting video whose layer was removed, e.g. after a channel change, must
  // not take a decoder: its widget stays mounted but may never be shown again.
  private isParked(waiter: WebosVideoPlayback): boolean {
    return !waiter.isPlayRequested() && !waiter.isAttached();
  }

  // Parked waiters are skipped until their layer is attached again, which
  // emits no event, so check again while any of them is waiting.
  private scheduleParkedRetry(): void {
    if (this.parkedRetryTimer !== undefined) return;
    if (!this.waiters.some((waiter) => this.isParked(waiter))) return;
    this.parkedRetryTimer = setTimeout(() => {
      this.parkedRetryTimer = undefined;
      this.drain();
    }, PARKED_RETRY_MS);
  }

  private nextWaiter(): WebosVideoPlayback | undefined {
    let best: WebosVideoPlayback | undefined;
    for (let i = 0; i < this.waiters.length; i++) {
      const waiter = this.waiters[i];
      if (this.isParked(waiter)) continue;
      if (!best) {
        best = waiter;
        continue;
      }
      const playDelta =
        Number(waiter.isPlayRequested()) - Number(best.isPlayRequested());
      if (
        playDelta > 0 ||
        (playDelta === 0 && waiter.displayArea() > best.displayArea())
      ) {
        best = waiter;
      }
    }
    return best;
  }

  private makeRoom(exclude: WebosVideoPlayback, forPlayback: boolean): boolean {
    if (this.holders.length < this.limit) return true;
    const candidates = this.holders
      .filter(
        (holder) => holder !== exclude && holder.isReleasable(forPlayback)
      )
      .sort(
        (a, b) =>
          Number(a.isAttached()) - Number(b.isAttached()) ||
          this.holders.indexOf(a) - this.holders.indexOf(b)
      );
    for (const holder of candidates) {
      if (this.holders.length < this.limit) break;
      holder.release('budget');
    }
    return this.holders.length < this.limit;
  }
}

export const webosDecoderBudget = new WebosDecoderBudget();

export const DECODER_LIMIT_ERROR_CODE = 'video-decoder-limit';

export const decoderLimitError = (capacity: number): Error =>
  new Error(
    `Video playback blocked: the player tried to play more than ${capacity} ` +
      `video${capacity === 1 ? '' : 's'} at the same time, the maximum this ` +
      'device supports. The blocked video was skipped, or, when no other ' +
      'playlist item could play, delayed until another video finished. ' +
      'Reduce the number of videos playing simultaneously (e.g. video zones ' +
      'in a layout) to avoid this.'
  );

export class WebosVideoPlayback implements VideoPlaybackController {
  private readonly logger = new Logger('WebOS Video');
  private readonly id = ++nextVideoId;
  private playRequestedAt?: number;
  private loadStartedAt?: number;
  private progressTimer?: ReturnType<typeof setInterval>;
  private progressState: 'waiting' | 'advancing' | 'stuck' = 'waiting';
  private lastPosition = 0;
  private lastAdvanceAt = 0;
  private lastLoggedRequest?: PlaybackRequest;
  private request?: PlaybackRequest;
  private cancelWait?: () => void;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private loading = false;
  private disposed = false;
  private hasPlayed = false;
  private recovered = false;
  private stallRecovered = false;
  private retryAfter = 0;
  private releasedSrc?: string;
  private waitingForDecoder = false;
  private resolveLoadable?: () => void;
  private initialLoad = false;
  private initialLoadTimer?: ReturnType<typeof setTimeout>;
  private preparing = 0;
  private awaitingFirstRequest = false;
  private drainTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private video: VideoElement,
    private reportError?: (input: PlayerRuntimeError) => void,
    private refreshMedia?: () => Promise<string | void>,
    private readonly budget: WebosDecoderBudget = webosDecoderBudget,
    private readonly setBlocked?: (block?: PlayerRuntimeError) => void
  ) {
    this.video.addEventListener('error', this.handlePlaybackError);
    MEDIA_EVENTS.forEach((event) =>
      this.video.addEventListener(event, this.logMediaEvent)
    );
    this.log('controller created');
  }

  async recoverMedia(): Promise<string | void> {
    if (!isWebosNativeUrl(this.source()) || !this.refreshMedia) return;
    this.log('refreshing native media');
    return this.refreshMedia();
  }

  private source(): string {
    return this.releasedSrc ?? this.video.src;
  }

  isAttached(): boolean {
    const element = this.video as unknown as Node;
    if (typeof Node === 'undefined' || !(element instanceof Node)) return true;
    return document.documentElement.contains(element);
  }

  // A freshly loaded video that has not been requested yet is about to be
  // shown; only release it for a video that needs to play now.
  isReleasable(forPlayback = true): boolean {
    return (
      !this.disposed &&
      !this.request?.play &&
      !this.loading &&
      !this.initialLoad &&
      this.preparing === 0 &&
      (forPlayback || !this.awaitingFirstRequest || !this.isAttached())
    );
  }

  isPlayRequested(): boolean {
    return !!this.request?.play;
  }

  displayArea(): number {
    const element = this.video as unknown as Partial<HTMLElement>;
    if (typeof element.getBoundingClientRect !== 'function') return 0;
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  // Resolves once this video may load its source. The widget assigns the
  // source afterwards, so a new video never loads while the decoders are
  // taken; until then the video is marked as blocked so playlists can skip it.
  whenLoadable(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      this.resolveLoadable = resolve;
      if (this.budget.claim(this)) {
        this.startInitialLoad();
      } else {
        this.setWaitingForDecoder(true);
      }
    });
  }

  // Called by the budget when a queued request can use a decoder.
  grantDecoder(): void {
    if (this.disposed) {
      this.budget.remove(this);
      return;
    }
    this.setWaitingForDecoder(false);
    const request = this.request;
    if (this.resolveLoadable) {
      this.log('decoder granted');
      this.startInitialLoad();
    } else if (request) {
      this.log('decoder granted');
      void this.prepare(request).catch((error: unknown) =>
        this.handlePrepareError(request, error)
      );
    } else {
      this.budget.remove(this);
    }
  }

  private describeBudget(): string {
    return ` decoders=${this.budget.size} waiting=${this.budget.waiting}`;
  }

  // Playlists skip an item that stays blocked and report the block; the
  // video keeps its place in the queue and starts once a decoder is free.
  private setWaitingForDecoder(waiting: boolean): void {
    if (this.waitingForDecoder === waiting) return;
    this.waitingForDecoder = waiting;
    if (waiting) {
      this.log(`waiting for decoder${this.describeBudget()}`);
      this.setBlocked?.({
        category: 'playback',
        code: DECODER_LIMIT_ERROR_CODE,
        error: decoderLimitError(this.budget.capacity),
      });
    } else {
      this.setBlocked?.();
    }
  }

  // The widget listens for readiness itself; this only keeps the decoder
  // from being released until the first load settles.
  private startInitialLoad(): void {
    const resolve = this.resolveLoadable;
    this.resolveLoadable = undefined;
    this.initialLoad = true;
    this.awaitingFirstRequest = true;
    INITIAL_LOAD_EVENTS.forEach((event) =>
      this.video.addEventListener(event, this.finishInitialLoad)
    );
    this.initialLoadTimer = setTimeout(
      this.finishInitialLoad,
      METADATA_TIMEOUT_MS
    );
    resolve?.();
  }

  private finishInitialLoad = (): void => {
    if (!this.initialLoad) return;
    this.initialLoad = false;
    clearTimeout(this.initialLoadTimer);
    this.initialLoadTimer = undefined;
    INITIAL_LOAD_EVENTS.forEach((event) =>
      this.video.removeEventListener(event, this.finishInitialLoad)
    );
    if (this.disposed) return;
    // Let the widget handle the same readiness event (e.g. read the duration)
    // before a queued video can take this decoder.
    this.drainTimer = setTimeout(() => {
      this.drainTimer = undefined;
      this.budget.drain();
    }, 0);
  };

  // Frees the decoder by removing the media source. WebOS otherwise reloads
  // detached videos on its own, competing with the video on screen.
  release(reason: string): void {
    if (this.releasedSrc !== undefined || !this.video.src) {
      this.budget.remove(this);
      return;
    }
    const src = this.video.src;
    this.cancelWait?.();
    this.loading = false;
    this.loadStartedAt = undefined;
    this.video.pause();
    this.releasedSrc = src;
    this.video.removeAttribute('src');
    this.video.load();
    this.log(`released decoder reason=${reason}`);
    // Hand the decoder to a queued video only after this one freed it.
    this.budget.remove(this);
  }

  // Assigning src starts the load algorithm, so no extra load() is needed.
  private restoreSource(): void {
    const src = this.releasedSrc;
    this.releasedSrc = undefined;
    if (src !== undefined && !this.video.getAttribute('src')) {
      this.video.src = src;
    } else {
      this.video.load();
    }
  }

  private log(message: string): void {
    if (!this.logger.enabled) return;
    const src = this.video.src;
    const source =
      this.releasedSrc !== undefined
        ? ' src=released'
        : isWebosNativeUrl(src)
          ? ''
          : src.indexOf('blob:') === 0
            ? ' src=blob'
            : src
              ? ' src=remote'
              : ' src=none';
    const flags = `${this.video.paused ? ' paused' : ''}${this.video.ended ? ' ended' : ''}`;
    const elapsed = `${this.playRequestedAt === undefined ? '' : ` play=${Date.now() - this.playRequestedAt}ms`}${this.loadStartedAt === undefined ? '' : ` load=${Date.now() - this.loadStartedAt}ms`}`;
    this.logger.log(
      `${new Date().toISOString().slice(11, 23)} #${this.id} ${message} | rs=${this.video.readyState} ns=${this.video.networkState} pos=${this.video.currentTime}${flags}${source}${elapsed}`
    );
  }

  // Media events can look healthy while WebOS shows no frames. Only report
  // what deviates from a visible, attached, full-screen, topmost video.
  private describeVisibility(): string {
    const element = this.video as unknown as HTMLElement;
    if (typeof element.getBoundingClientRect !== 'function') return '';
    const duration = (this.video as { duration?: number }).duration;
    const parts = [`duration=${duration === undefined ? '-' : duration}`];
    try {
      if (!document.documentElement.contains(element)) {
        return ` ${parts.concat('detached').join(' ')}`;
      }
      const rect = element.getBoundingClientRect();
      if (
        Math.round(rect.width) !== window.innerWidth ||
        Math.round(rect.height) !== window.innerHeight ||
        Math.round(rect.left) !== 0 ||
        Math.round(rect.top) !== 0
      ) {
        parts.push(
          `rect=${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.left)},${Math.round(rect.top)}`
        );
      }

      for (
        let node: HTMLElement | null = element;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        const style = window.getComputedStyle(node);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        ) {
          // visibility is inherited; report the ancestor that introduced it.
          let origin = node;
          if (style.display !== 'none' && style.opacity !== '0') {
            while (
              origin.parentElement &&
              origin.parentElement !== document.documentElement &&
              window.getComputedStyle(origin.parentElement).visibility ===
                'hidden'
            ) {
              origin = origin.parentElement;
            }
          }
          const originStyle = window.getComputedStyle(origin);
          parts.push(
            `hiddenBy=${origin.tagName.toLowerCase()}${origin.dataset.layer === undefined ? '' : `[layer=${origin.dataset.layer}]`}(display=${originStyle.display},visibility=${originStyle.visibility},opacity=${originStyle.opacity},z=${origin.style.zIndex || 'auto'})`
          );
          break;
        }
      }

      if (rect.width > 0 && rect.height > 0) {
        const top = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        if (top !== element) {
          parts.push(
            `coveredBy=${top ? `${top.tagName.toLowerCase()}${top instanceof HTMLElement && top.dataset.name ? `[${top.dataset.name}]` : ''}` : 'none'}`
          );
        }
      }

      const videos = document.getElementsByTagName('video');
      let playing = 0;
      for (let i = 0; i < videos.length; i++) {
        if (!videos[i].paused) playing++;
      }
      parts.push(
        `videos=${playing}/${videos.length} decoders=${this.budget.size}${this.budget.waiting > 0 ? ` waiting=${this.budget.waiting}` : ''}`
      );
    } catch (error) {
      parts.push(
        `visibilityError=${error instanceof Error ? error.message : String(error)}`
      );
    }
    return ` ${parts.join(' ')}`;
  }

  // Watches playback progress while a play request is active. Only
  // transitions are logged: the first advance, a stall, and its recovery.
  private startProgressWatch(): void {
    this.stopProgressWatch();
    this.progressState = 'waiting';
    this.lastPosition = this.video.currentTime;
    this.lastAdvanceAt = Date.now();
    this.progressTimer = setInterval(this.checkProgress, PROGRESS_CHECK_MS);
  }

  private stopProgressWatch(): void {
    if (this.progressTimer !== undefined) clearInterval(this.progressTimer);
    this.progressTimer = undefined;
  }

  private checkProgress = (): void => {
    if (!this.request?.play || this.video.paused) {
      this.lastAdvanceAt = Date.now();
      return;
    }
    const position = this.video.currentTime;
    const now = Date.now();
    if (position !== this.lastPosition) {
      if (this.progressState !== 'advancing') {
        this.log(
          this.progressState === 'stuck'
            ? `progress resumed afterMs=${now - this.lastAdvanceAt}`
            : 'progress started'
        );
      }
      this.progressState = 'advancing';
      this.lastPosition = position;
      this.lastAdvanceAt = now;
    } else if (
      this.progressState !== 'stuck' &&
      now - this.lastAdvanceAt >= NO_PROGRESS_MS
    ) {
      this.progressState = 'stuck';
      this.log(
        `no progress forMs=${now - this.lastAdvanceAt}${this.describeVisibility()}`
      );
      this.recoverStall(now);
    }
  };

  // WebOS can report a playing video whose position no longer advances, e.g.
  // after other videos reload and take its decoder. Reload it once per play
  // request and resume where the playlist expects it to be.
  private recoverStall(now: number): void {
    const request = this.request;
    if (!request?.play || this.stallRecovered || this.disposed) return;
    const duration = (this.video as { duration?: number }).duration;
    if (
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      this.lastPosition >= duration - STALL_END_MARGIN_SECONDS
    ) {
      return;
    }
    this.stallRecovered = true;
    const offset = Math.round(
      this.lastPosition * 1000 + (now - this.lastAdvanceAt)
    );
    this.log(`recovering stalled playback offsetMs=${offset}`);
    this.schedule(offset, true, true);
  }

  private logMediaEvent = (event: Event): void => {
    this.log(
      `event=${event.type}${event.type === 'error' ? ` mediaErrorCode=${this.video.error?.code ?? 'none'}` : ''}${event.type === 'loadedmetadata' ? ` dims=${this.video.videoWidth}x${this.video.videoHeight}` : ''}${event.type === 'playing' ? this.describeVisibility() : ''}`
    );
  };

  private handlePlaybackError = (): void => {
    if (!this.hasPlayed || !this.request?.play || this.disposed) return;
    if (
      this.recovered ||
      !isWebosNativeUrl(this.video.src) ||
      !this.refreshMedia
    ) {
      this.log('reporting decoder error');
      this.reportError?.({
        category: 'media-load',
        code: 'video-load-failed',
        error: this.video.error ?? new Error('Video failed to load'),
      });
      return;
    }
    this.recovered = true;
    const offset = Number.isFinite(this.video.currentTime)
      ? this.video.currentTime * 1000
      : 0;
    this.log(`recovering decoder error offsetMs=${offset}`);
    const request = this.request;
    void this.recoverMedia()
      .then((url) => {
        if (this.disposed || !request || this.request !== request) return;
        if (!url) throw new Error('Failed to refresh WebOS video media');
        this.video.src = url;
        this.log('native media refreshed; resuming playback');
        this.schedule(offset, true);
      })
      .catch((error: unknown) => {
        if (this.disposed || this.request !== request) return;
        console.error('[WebOS Video] Failed to recover media', error);
        this.reportError?.({
          category: 'media-load',
          code: 'video-load-failed',
          error,
        });
      });
  };

  seek(offset: number): void {
    this.schedule(offset, false);
  }

  play(offset: number): void {
    this.schedule(offset, true);
  }

  pause(): void {
    if (this.request || !this.video.paused) this.log('pause');
    this.stopProgressWatch();
    this.lastLoggedRequest = undefined;
    this.request = undefined;
    this.cancelWait?.();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.loading = false;
    this.video.pause();
    this.playRequestedAt = undefined;
    this.loadStartedAt = undefined;
    if (this.waitingForDecoder && !this.resolveLoadable) {
      this.setWaitingForDecoder(false);
      this.budget.cancel(this);
    }
    // A paused video can hand its decoder to a queued one. The hand-off
    // waits for the caller to finish, e.g. a renderer that pauses a layer
    // before removing it, so videos of a removed layer are not granted one.
    this.budget.requestDrain();
  }

  dispose(): void {
    if (this.disposed) return;
    this.log('dispose');
    this.disposed = true;
    this.pause();
    this.finishInitialLoad();
    clearTimeout(this.drainTimer);
    this.drainTimer = undefined;
    this.release('dispose');
    this.resolveLoadable?.();
    this.resolveLoadable = undefined;
    this.setWaitingForDecoder(false);
    this.video.removeEventListener('error', this.handlePlaybackError);
    MEDIA_EVENTS.forEach((event) =>
      this.video.removeEventListener(event, this.logMediaEvent)
    );
  }

  private schedule(offset: number, play: boolean, reload = false): void {
    if (this.disposed) return;
    this.awaitingFirstRequest = false;
    if (!reload) this.stallRecovered = false;
    if (play) {
      this.playRequestedAt = Date.now();
      this.startProgressWatch();
    }
    // The timeline repeats near-identical seeks while a layer is shown.
    const last = this.lastLoggedRequest;
    if (!last || last.play !== play || !(Math.abs(last.offset - offset) < 50)) {
      this.log(`request=${play ? 'play' : 'seek'} offsetMs=${offset}`);
      this.lastLoggedRequest = { offset, play };
    }
    this.cancelWait?.();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const request: PlaybackRequest = (this.request = { offset, play, reload });
    const retryDelay = this.retryAfter - Date.now();
    if (retryDelay > 0 && play) {
      this.log(`decoder retry scheduled delayMs=${retryDelay}`);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        if (this.request === request) this.schedule(offset, true);
      }, retryDelay);
      return;
    }
    if (retryDelay > 0) return;
    if (
      play &&
      !reload &&
      this.hasPlayed &&
      offset < RESTART_DEFER_MAX_OFFSET_MS &&
      this.video.currentTime * 1000 - offset >= RESTART_DEFER_MIN_JUMP_MS &&
      !this.video.ended &&
      this.video.readyState >= 2
    ) {
      // A widget timeline can wrap just before the playlist ends the slot.
      // Reloading at once would blank the visible layer during the handoff,
      // so give the playlist a chance to pause it first.
      this.log(`deferring restart delayMs=${RESTART_DEFER_MS}`);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        if (this.request !== request) return;
        this.log('deferred restart continuing');
        void this.prepare(request).catch((error: unknown) =>
          this.handlePrepareError(request, error)
        );
      }, RESTART_DEFER_MS);
      return;
    }
    // Coalesce a timeline seek followed immediately by play into one operation.
    void Promise.resolve()
      .then(() => this.prepare(request))
      .catch((error: unknown) => this.handlePrepareError(request, error));
  }

  private handlePrepareError(request: PlaybackRequest, error: unknown): void {
    if (this.request !== request) return;
    console.error('[WebOS Video] Failed to prepare playback', error);
    this.reportError?.({
      category: 'playback',
      code: 'video-load-failed',
      error,
    });
    if (request.play && Date.now() < this.retryAfter) {
      this.schedule(request.offset, true);
    }
  }

  // While preparing, the video is about to seek or play and must keep its
  // decoder even between a metadata event and the continuation.
  private async prepare(request: PlaybackRequest): Promise<void> {
    this.preparing++;
    try {
      await this.prepareRequest(request);
    } finally {
      this.preparing--;
      if (!this.disposed) this.budget.drain();
    }
  }

  private async prepareRequest(request: PlaybackRequest): Promise<void> {
    if (this.request !== request) return;
    if (!Number.isFinite(request.offset) || request.offset < 0) {
      throw new Error('Invalid video playback offset');
    }
    this.video.pause();
    const target = request.offset / 1000;
    const restart = request.play && this.hasPlayed && request.offset < 50;

    if (!request.play && this.hasPlayed && !this.isAttached()) {
      this.release('detached');
      return;
    }

    if (
      !request.play &&
      target === 0 &&
      !this.loading &&
      this.video.readyState < 1 &&
      this.video.currentTime === 0
    ) {
      this.log('skipping load for paused video already at start');
      return;
    }

    const released = this.releasedSrc !== undefined;
    if (this.resolveLoadable) return;
    if (!this.budget.claim(this)) {
      this.setWaitingForDecoder(true);
      return;
    }
    this.setWaitingForDecoder(false);

    if (
      this.loading ||
      released ||
      restart ||
      request.reload ||
      this.video.ended ||
      this.video.readyState < 1
    ) {
      const reason = this.loading
        ? 'pending'
        : released
          ? 'released'
          : request.reload
            ? 'stalled'
            : restart
              ? 'restart'
              : this.video.ended
                ? 'ended'
                : 'unready';
      if (!(await this.waitForMetadata(reason))) return;
    }
    if (this.request !== request) return;

    try {
      this.seekTo(target);
    } catch (error) {
      const invalidState =
        typeof error === 'object' &&
        error !== null &&
        (('name' in error && error.name === 'InvalidStateError') ||
          ('code' in error && error.code === 11));
      if (this.video.readyState >= 1 && !invalidState) throw error;
      // WebOS can report metadata while its decoder still rejects a seek.
      // Retry only once, and only after a fresh metadata event.
      this.log('seek rejected; reloading metadata for one retry');
      if (
        !(await this.waitForMetadata('seek-rejected')) ||
        this.request !== request
      )
        return;
      this.seekTo(target);
    }

    if (request.play && this.request === request) {
      this.hasPlayed = true;
      this.log('calling play');
      playVideo(this.video, this.reportError);
    }
  }

  private seekTo(target: number): void {
    if (Math.abs(this.video.currentTime - target) >= 0.05) {
      this.log(`seeking targetSeconds=${target}`);
      this.video.currentTime = target;
    }
  }

  private waitForMetadata(reason: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        this.video.removeEventListener('loadedmetadata', loaded);
        this.video.removeEventListener('loadeddata', loaded);
        this.video.removeEventListener('canplay', loaded);
        this.video.removeEventListener('error', failed);
        this.cancelWait = undefined;
      };
      const loaded = (event?: Event) => {
        if (settled || this.video.readyState < 1) return;
        // loadedmetadata is already logged as a media event.
        if (event?.type !== 'loadedmetadata') {
          this.log(`metadata ready via=${event?.type ?? 'readyState'}`);
        }
        this.loadStartedAt = undefined;
        settled = true;
        cleanup();
        this.loading = false;
        this.retryAfter = 0;
        resolve(true);
      };
      const failed = () => {
        if (settled) return;
        this.log('metadata load failed');
        this.loadStartedAt = undefined;
        settled = true;
        cleanup();
        this.loading = false;
        reject(this.video.error ?? new Error('Video failed to load'));
      };
      const timer = setTimeout(() => {
        if (settled) return;
        if (this.video.readyState >= 1) {
          loaded();
          return;
        }
        this.log(`metadata timeout retryDelayMs=${METADATA_RETRY_DELAY_MS}`);
        this.loadStartedAt = undefined;
        settled = true;
        cleanup();
        this.loading = false;
        this.retryAfter = Date.now() + METADATA_RETRY_DELAY_MS;
        reject(new Error('Timed out waiting for video metadata'));
      }, METADATA_TIMEOUT_MS);
      this.cancelWait = () => {
        if (settled) return;
        this.log('metadata wait cancelled');
        this.loadStartedAt = undefined;
        settled = true;
        cleanup();
        resolve(false);
      };

      this.video.addEventListener('loadedmetadata', loaded);
      this.video.addEventListener('loadeddata', loaded);
      this.video.addEventListener('canplay', loaded);
      this.video.addEventListener('error', failed);
      if (!this.loading) {
        this.loading = true;
        try {
          this.loadStartedAt = Date.now();
          this.log(`calling load reason=${reason}`);
          if (this.releasedSrc !== undefined) this.restoreSource();
          else this.video.load();
        } catch (error) {
          if (settled) return;
          settled = true;
          cleanup();
          this.loading = false;
          this.loadStartedAt = undefined;
          reject(error);
        }
        if (this.video.readyState >= 1) loaded();
      } else {
        this.log(`waiting for pending load reason=${reason}`);
        if (this.video.readyState >= 1) loaded();
      }
    });
  }
}

export const createWebosVideoPlayback: VideoPlaybackControllerFactory = (
  video,
  { reportError, refreshMedia, setBlocked }
) =>
  new WebosVideoPlayback(
    video,
    reportError,
    refreshMedia,
    webosDecoderBudget,
    setBlocked
  );
