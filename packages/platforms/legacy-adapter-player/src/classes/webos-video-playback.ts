import {
  playVideo,
  type PlayerRuntimeError,
  type VideoPlaybackController,
  type VideoPlaybackControllerFactory,
} from '@castmill/player';
import { isWebosNativeUrl } from './webos-legacy-file-storage';

type VideoElement = Pick<
  HTMLVideoElement,
  | 'readyState'
  | 'ended'
  | 'currentTime'
  | 'error'
  | 'src'
  | 'load'
  | 'play'
  | 'pause'
  | 'addEventListener'
  | 'removeEventListener'
>;

interface PlaybackRequest {
  offset: number;
  play: boolean;
}

const METADATA_TIMEOUT_MS = 15_000;
const METADATA_RETRY_DELAY_MS = 30_000;

export class WebosVideoPlayback implements VideoPlaybackController {
  private request?: PlaybackRequest;
  private cancelWait?: () => void;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private loading = false;
  private disposed = false;
  private hasPlayed = false;
  private recovered = false;
  private retryAfter = 0;

  constructor(
    private video: VideoElement,
    private reportError?: (input: PlayerRuntimeError) => void,
    private refreshMedia?: () => Promise<string | void>
  ) {
    this.video.addEventListener('error', this.handlePlaybackError);
  }

  async recoverMedia(): Promise<string | void> {
    if (!isWebosNativeUrl(this.video.src) || !this.refreshMedia) return;
    return this.refreshMedia();
  }

  private handlePlaybackError = (): void => {
    if (!this.hasPlayed || this.disposed) return;
    if (
      this.recovered ||
      !isWebosNativeUrl(this.video.src) ||
      !this.refreshMedia
    ) {
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
    const request = this.request;
    void this.recoverMedia()
      .then((url) => {
        if (this.disposed || this.request !== request) return;
        if (!url) throw new Error('Failed to refresh WebOS video media');
        this.video.src = url;
        this.schedule(offset, true);
      })
      .catch((error: unknown) => {
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
    this.request = undefined;
    this.cancelWait?.();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.loading = false;
    this.video.pause();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    this.video.removeEventListener('error', this.handlePlaybackError);
  }

  private schedule(offset: number, play: boolean): void {
    if (this.disposed) return;
    this.cancelWait?.();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const request = (this.request = { offset, play });
    const retryDelay = this.retryAfter - Date.now();
    if (retryDelay > 0 && play) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        if (this.request === request) this.schedule(offset, true);
      }, retryDelay);
      return;
    }
    if (retryDelay > 0) return;
    // Coalesce a timeline seek followed immediately by play into one operation.
    void Promise.resolve()
      .then(() => this.prepare(request))
      .catch((error: unknown) => {
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
      });
  }

  private async prepare(request: PlaybackRequest): Promise<void> {
    if (this.request !== request) return;
    if (!Number.isFinite(request.offset) || request.offset < 0) {
      throw new Error('Invalid video playback offset');
    }
    this.video.pause();
    const target = request.offset / 1000;
    const restart = request.play && this.hasPlayed && request.offset < 50;

    if (
      this.loading ||
      restart ||
      this.video.ended ||
      this.video.readyState < 1
    ) {
      if (!(await this.waitForMetadata())) return;
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
      if (!(await this.waitForMetadata()) || this.request !== request) return;
      this.seekTo(target);
    }

    if (request.play && this.request === request) {
      this.hasPlayed = true;
      playVideo(this.video, this.reportError);
    }
  }

  private seekTo(target: number): void {
    if (Math.abs(this.video.currentTime - target) >= 0.05) {
      this.video.currentTime = target;
    }
  }

  private waitForMetadata(): Promise<boolean> {
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
      const loaded = () => {
        if (settled || this.video.readyState < 1) return;
        settled = true;
        cleanup();
        this.loading = false;
        this.retryAfter = 0;
        resolve(true);
      };
      const failed = () => {
        if (settled) return;
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
        settled = true;
        cleanup();
        this.loading = false;
        this.retryAfter = Date.now() + METADATA_RETRY_DELAY_MS;
        reject(new Error('Timed out waiting for video metadata'));
      }, METADATA_TIMEOUT_MS);
      this.cancelWait = () => {
        if (settled) return;
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
          this.video.load();
        } catch (error) {
          if (settled) return;
          settled = true;
          cleanup();
          this.loading = false;
          reject(error);
        }
        if (this.video.readyState >= 1) loaded();
      } else if (this.video.readyState >= 1) {
        loaded();
      }
    });
  }
}

export const createWebosVideoPlayback: VideoPlaybackControllerFactory = (
  video,
  { reportError, refreshMedia }
) => new WebosVideoPlayback(video, reportError, refreshMedia);
