import { ResourceManager } from '@castmill/cache';

import { Status } from './playable';
import { Layer } from './layer';
import { EventEmitter } from 'eventemitter3';
import { of, from, race, defer, Observable, Subscription } from 'rxjs';
import {
  concatMap,
  filter,
  finalize,
  take,
  map,
  repeat,
  share,
  takeWhile,
  tap,
  switchMap,
} from 'rxjs/operators';
import { PlaybackPhase, Renderer } from './renderer';
import { JsonPlaylist } from './';
import {
  PlayerGlobals,
  PlayerRuntimeError,
} from './interfaces/player-globals.interface';
import { DebugItemInfo, isDebugOverlayEnabled } from './debug';

/**
 * How long the current item may stay blocked (e.g. a video waiting for a
 * hardware decoder) before the playlist skips to the next item.
 */
export const BLOCKED_ITEM_SKIP_MS = 1000;

const SAMPLE_MS = 1000;
const PREPARATION_TIMEOUT_MS = 45_000;
const STALL_GRACE_MS = 5000;
const RESTART_COOLDOWN_MS = 120_000;

interface PlaybackStats {
  items: number;
  skips: number;
  restarts: number;
  lastRestart?: string;
  tickGap: number;
  lastTick?: number;
  lastDraw?: number;
  slowestPreparation: number;
  slowestTransition: number;
}

/**
 * Maps the timer onto playlist time. The mapping can be shifted forward to
 * skip an item, and held while the current item is blocked so the item still
 * starts from its beginning. The shift lasts for one `play` call.
 */
class PlaylistClock {
  private skew = 0;
  private held?: number;
  private last = 0;
  private lastValue?: number;
  private period: number;

  // `start` is the playlist time playback starts at, so an item that is
  // already blocked before the first tick is held at its start offset.
  constructor(
    private readonly duration: () => number,
    start = 0,
    private readonly loop = true
  ) {
    this.period = duration();
    this.last = this.wrap(start);
  }

  map(value: number): number {
    const period = this.duration();
    if (period !== this.period) {
      // An item duration changed (e.g. measured during playback): continue
      // from the last playlist time instead of re-wrapping the skewed time.
      if (this.lastValue !== undefined) this.skew = this.last - this.lastValue;
      this.period = period;
    }
    this.lastValue = value;
    if (this.held !== undefined) {
      this.skew = this.held - value;
    }
    this.last = this.wrap(value + this.skew);
    return this.last;
  }

  hold(start: number, end: number): void {
    if (this.held !== undefined) return;
    // Hold inside the item's slot, also when the previous slot's last tick
    // is the latest mapped time.
    this.held = this.last >= start && this.last < end ? this.last : start;
  }

  release(): void {
    this.held = undefined;
  }

  jumpTo(time: number): void {
    this.held = undefined;
    this.skew += this.wrap(time) - this.last;
    this.last = this.wrap(time);
  }

  private wrap(value: number): number {
    const duration = this.duration();
    return this.loop && duration > 0
      ? ((value % duration) + duration) % duration
      : value;
  }
}

interface LayerWithOffsets {
  start: number;
  end: number;
  duration: number;
  layer: Layer;
}

function debugItem({ layer, duration }: LayerWithOffsets): DebugItemInfo {
  let itemDuration: number | undefined;
  try {
    itemDuration = layer.duration();
  } catch {
    itemDuration = undefined;
  }
  return {
    name: layer.name,
    widget: layer.debugInfo.widget,
    type: layer.debugInfo.type,
    media: layer.debugInfo.media,
    duration,
    itemDuration,
  };
}

export class Playlist extends EventEmitter {
  public layers: Layer[] = [];

  time: number = 0;

  status: Status = Status.NotReady;

  private debugLayer?: HTMLElement;

  /** Id of the JSON playlist this playlist was created from, if any. */
  public id?: number | string;

  private lastRestartAt = -Infinity;
  private readonly playbackStats: PlaybackStats = {
    items: 0,
    skips: 0,
    restarts: 0,
    tickGap: 0,
    slowestPreparation: 0,
    slowestTransition: 0,
  };

  constructor(
    public name: string,
    private resourceManager: ResourceManager,
    private globals?: PlayerGlobals
  ) {
    super();
    // this.toggleDebug();
  }

  /**
   * Deserializes a plain object (as the result of JSON.parse) into a Playlist
   * including all the items, settings, etc.
   *
   * @param json
   */
  static fromJSON(
    json: JsonPlaylist,
    resourceManager: ResourceManager,
    globals: PlayerGlobals = { target: 'preview' }
  ) {
    if (json.locale && !globals.locale) {
      globals = { ...globals, locale: json.locale };
    }
    const playlist = new Playlist(json.name, resourceManager, globals);
    playlist.id = json.id;
    const items = json.items || [];
    const itemGlobals = { ...globals, loopPlaylistItem: items.length === 1 };

    for (let i = 0; i < items.length; i++) {
      const layer = Layer.fromJSON(items[i], resourceManager, itemGlobals);
      playlist.add(layer);
    }
    return playlist;
  }

  play(
    renderer: Renderer,
    timer$: Observable<number>,
    opts?: { loop?: boolean }
  ) {
    return defer(() => this.playLayers(renderer, timer$, opts ?? {})).pipe(
      finalize(() => renderer.debugOverlay?.hide())
    );
  }

  toggleDebug() {
    this.layers.map((layer) => layer.toggleDebug());
  }

  private getLayersWithOffsets(): LayerWithOffsets[] {
    const layers = this.layers;
    return layers.map((layer, index) => {
      const start = () =>
        layers
          .slice(0, index)
          .reduce((end, previous) => end + previous.duration(), 0);
      return {
        get start() {
          return start();
        },
        get duration() {
          return layer.duration();
        },
        get end() {
          return start() + layer.duration();
        },
        layer,
      };
    });
  }

  private playLayers(
    renderer: Renderer,
    timer$: Observable<number>,
    { loop = false }
  ) {
    const item = this.findLayer(this.time);

    if (item) {
      const { offset, index, layersWithOffsets } = item;
      // The first layer must be seeked at a relative offset, the rest after it with offset 0.
      let first = 1;

      // Rotate array when loop is active
      // (so that we can have a complete array to loop with from current item offset)
      const elements = loop
        ? layersWithOffsets
            .slice(index)
            .concat(layersWithOffsets.slice(0, index))
        : layersWithOffsets.slice(index);

      // We start playing from the found layer at the current offset.
      const duration = () =>
        layersWithOffsets.reduce((acc, item) => acc + item.duration, 0);
      const clock = new PlaylistClock(duration, this.time, loop);
      const skips = { count: 0 };
      const stats = this.playbackStats;
      stats.lastTick = undefined;
      stats.lastDraw = undefined;
      const playlistTimer$ = timer$.pipe(
        map((value) => clock.map(value)),
        tap((value) => {
          const now = Date.now();
          if (stats.lastTick !== undefined) {
            stats.tickGap = Math.max(stats.tickGap, now - stats.lastTick);
          }
          stats.lastTick = now;
          this.time = value;
        }),
        share()
      );

      const playing$ = from(elements).pipe(
        concatMap((element, i) => {
          const layerOffset = first ? offset : 0;
          first = 0;
          stats.items++;
          const itemIndex = layersWithOffsets.indexOf(element);
          this.notifyItemStart(itemIndex, layersWithOffsets.length);
          const next =
            i + 1 < elements.length
              ? elements[i + 1]
              : loop
                ? elements[0]
                : undefined;
          return this.playMonitoredItem(
            renderer,
            clock,
            playlistTimer$,
            element,
            skips,
            layersWithOffsets.length,
            layerOffset,
            stats,
            (health) =>
              this.updateDebugOverlay(
                renderer,
                Math.max(
                  0,
                  Math.min(this.time - element.start, element.duration)
                ),
                element,
                next,
                {
                  index: itemIndex,
                  count: layersWithOffsets.length,
                  duration: duration(),
                },
                health
              ),
            !loop
          );
        })
      );

      if (loop) {
        return playing$.pipe(repeat());
      } else {
        return playing$;
      }
    } else {
      return of('end');
    }
  }

  private notifyItemStart(index: number, count: number) {
    const onItemStart = this.globals?.onItemStart;
    if (!onItemStart) return;
    try {
      onItemStart({ playlistId: this.id, index, count });
    } catch {
      // A host callback must never break playback.
    }
  }

  /**
   * Plays an item, holding the playlist clock while the item is blocked. An
   * item blocked for BLOCKED_ITEM_SKIP_MS is skipped. When every item has
   * been skipped in a row, skipping would only cycle through blocked items,
   * so the area is left empty and the item plays as soon as it can.
   * Unsignalled stalls can retry without restarting the zone's clock.
   */
  private playMonitoredItem(
    renderer: Renderer,
    clock: PlaylistClock,
    timer$: Observable<number>,
    element: LayerWithOffsets,
    skips: { count: number },
    count: number,
    layerOffset: number,
    stats: PlaybackStats,
    draw: (health: string[]) => void,
    holdOnReadiness: boolean
  ): Observable<string | number> {
    return new Observable<string | number>((subscriber) => {
      let skipTimer: ReturnType<typeof setTimeout> | undefined;
      let waiting = false;
      let playing: Subscription | undefined;
      const layer = element.layer;
      let phase: PlaybackPhase = 'seeking';
      let phaseStarted = Date.now();
      let preparationStarted = phaseStarted;
      let phaseDeadline = phaseStarted + PREPARATION_TIMEOUT_MS;
      let slotEnded: number | undefined;
      let preparingRetry = false;
      let lastSample = phaseStarted;
      let suspendedAt = -Infinity;
      const recover = this.globals?.recoverStalledPlayback;

      const setPhase = (next: PlaybackPhase, expected = 0) => {
        const now = Date.now();
        if (phase === 'showing') {
          stats.slowestPreparation = Math.max(
            stats.slowestPreparation,
            now - preparationStarted
          );
        }
        if (phase === 'transitioning') {
          stats.slowestTransition = Math.max(
            stats.slowestTransition,
            now - phaseStarted
          );
        }
        phase = next;
        phaseStarted = now;
        phaseDeadline =
          now +
          (next === 'transitioning'
            ? expected + STALL_GRACE_MS
            : PREPARATION_TIMEOUT_MS);
        if (
          preparingRetry &&
          (next === 'playing' || next === 'transitioning')
        ) {
          preparingRetry = false;
          updateClock();
        }
      };

      const stopTimer = () => {
        clearTimeout(skipTimer);
        skipTimer = undefined;
      };

      const onBlockExpired = () => {
        skipTimer = undefined;
        if (!block) return;
        layer.reportError(block);
        if (skips.count + 1 < count) {
          skips.count++;
          stats.skips++;
          clock.jumpTo(element.end);
          playing?.unsubscribe();
          subscriber.complete();
        } else {
          waiting = true;
          renderer.blank(layer);
        }
      };

      let block: PlayerRuntimeError | undefined;
      let readinessBlock: PlayerRuntimeError | undefined;
      const updateClock = () => {
        if (preparingRetry || block || (holdOnReadiness && readinessBlock)) {
          clock.hold(element.start, element.end);
        } else {
          clock.release();
        }
      };
      const onBlocked = (value: PlayerRuntimeError | undefined) => {
        if (block && !value) suspendedAt = Date.now();
        block = value;
        if (value) {
          if (!waiting && skipTimer === undefined) {
            skipTimer = setTimeout(onBlockExpired, BLOCKED_ITEM_SKIP_MS);
          }
        } else {
          stopTimer();
        }
        updateClock();
      };

      // Keeps the clock running while the item waits to be shown, so holds
      // and skips start from the current time.
      const ticking = timer$.subscribe();
      const blocked = layer.blocked$().subscribe(onBlocked);
      const readiness =
        holdOnReadiness || recover || renderer.debugOverlay
          ? (layer.readiness$?.() ?? of(undefined)).subscribe((value) => {
              if (readinessBlock && !value) suspendedAt = Date.now();
              readinessBlock = value;
              updateClock();
            })
          : undefined;
      const start = (offset: number, retry = false) =>
        this.playLayer(
          renderer,
          timer$,
          layer,
          offset,
          () => element.start,
          () => element.end,
          setPhase,
          () => {
            slotEnded ??= Date.now();
          },
          retry
        ).subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => {
            skips.count = 0;
            subscriber.complete();
          },
        });

      const sample = () => {
        const now = Date.now();
        const debug = !!renderer.debugOverlay && isDebugOverlayEnabled();
        const late = now - lastSample > SAMPLE_MS + STALL_GRACE_MS;
        lastSample = now;
        if (late || (typeof document !== 'undefined' && document.hidden)) {
          suspendedAt = now;
        }
        if (!debug && !recover) return;
        const widget = layer.samplePlayback?.() ?? [];
        const expired = (deadline: number) =>
          now >= deadline && now >= suspendedAt + STALL_GRACE_MS;
        const stall =
          phase !== 'playing' && expired(phaseDeadline)
            ? phase
            : phase === 'playing' &&
                slotEnded !== undefined &&
                expired(slotEnded + STALL_GRACE_MS)
              ? 'finishing'
              : widget.some(
                    ({ deadline }) =>
                      deadline !== undefined && expired(deadline)
                  )
                ? 'widget transition'
                : undefined;
        const intentionalWait =
          block ||
          readinessBlock?.category === 'playback' ||
          (readinessBlock &&
            phase === 'playing' &&
            stall !== 'widget transition');
        if (
          debug &&
          (stats.lastDraw === undefined || now - stats.lastDraw >= SAMPLE_MS)
        ) {
          stats.lastDraw = now;
          const reason = block || readinessBlock;
          const health = [
            `${block ? 'blocked' : phase} ${now - phaseStarted}ms${reason?.code ? ` (${reason.code})` : ''}`,
            `Items ${stats.items} · skips ${stats.skips} · restarts ${stats.restarts}`,
            `Peak ms: tick ${stats.tickGap} · prep ${stats.slowestPreparation}`,
            `Peak transition ${stats.slowestTransition}ms`,
          ];
          if (stats.lastRestart)
            health.push(`Last restart: ${stats.lastRestart}`);
          if (stall && !intentionalWait) health.push(`Stalled: ${stall}`);
          if (
            stats.lastTick !== undefined &&
            now - stats.lastTick > STALL_GRACE_MS
          )
            health.push(`No clock tick for ${now - stats.lastTick}ms`);
          const el = renderer.el;
          health.push(
            `DOM ${el.getElementsByTagName('*').length} · video ${el.getElementsByTagName('video').length} · img ${el.getElementsByTagName('img').length}`
          );
          widget.slice(0, 4).forEach(({ label }) => health.push(label));
          draw(health);
        }
        if (
          !recover ||
          !stall ||
          intentionalWait ||
          now - this.lastRestartAt < RESTART_COOLDOWN_MS
        )
          return;

        this.lastRestartAt = now;
        stats.restarts++;
        stats.lastRestart = stall;
        const pending = new Set<string>();
        for (let i = widget.length - 1; i >= 0 && pending.size < 6; i--) {
          const detail = widget[i].pending;
          if (detail) pending.add(detail);
        }
        if (pending.size) {
          console.warn('[Playback] Playlist stall', {
            phase: stall,
            elapsedMs: now - phaseStarted,
            pending: [...pending],
          });
        }
        layer.reportError({
          category: 'playback',
          code: 'playlist-stall-restart',
          error: `Restarting stalled playlist item (${stall})${pending.size ? `: ${[...pending].join('; ')}` : ''}`,
          context: { playlistId: this.id, layerName: layer.name },
        });
        playing?.unsubscribe();
        renderer.resetStalledLayer(layer);
        clock.jumpTo(element.start);
        preparingRetry = true;
        updateClock();
        slotEnded = undefined;
        preparationStarted = now;
        setPhase('seeking');
        playing = start(0, true);
      };
      playing = start(layerOffset);
      // Short items may complete before the periodic sample.
      if (
        !subscriber.closed &&
        renderer.debugOverlay &&
        isDebugOverlayEnabled()
      )
        sample();
      const healthTimer =
        !subscriber.closed && (renderer.debugOverlay || recover)
          ? setInterval(sample, SAMPLE_MS)
          : undefined;

      return () => {
        clearInterval(healthTimer);
        stopTimer();
        blocked.unsubscribe();
        readiness?.unsubscribe();
        playing?.unsubscribe();
        ticking.unsubscribe();
        clock.release();
      };
    });
  }

  private playLayer(
    renderer: Renderer,
    timer$: Observable<number>,
    layer: Layer,
    layerOffset: number,
    start: () => number,
    end: () => number,
    onPhase: (phase: PlaybackPhase, expectedMs?: number) => void,
    onSlotEnd: () => void,
    retry: boolean
  ): Observable<string | number> {
    const volume = 100;
    return renderer.play(
      layer,
      timer$.pipe(
        takeWhile((value) => {
          const inSlot = value >= start() && value < end();
          if (!inSlot) onSlotEnd();
          return inSlot;
        }),
        map((value) => value - start()),
        share()
      ),
      layerOffset,
      volume,
      onPhase,
      retry
    );
  }

  private updateDebugOverlay(
    renderer: Renderer,
    elapsed: number,
    current: LayerWithOffsets,
    next: LayerWithOffsets | undefined,
    {
      index,
      count,
      duration,
    }: { index: number; count: number; duration: number },
    health: string[]
  ): void {
    const overlay = renderer.debugOverlay;
    if (!overlay) return;
    if (!isDebugOverlayEnabled()) {
      overlay.hide();
      return;
    }
    overlay.update({
      index,
      count,
      elapsed,
      health,
      current: debugItem(current),
      next: next && next !== current ? debugItem(next) : undefined,
      playlist: {
        name: this.name,
        elapsed: current.start + elapsed,
        duration,
      },
    });
  }

  /**
   * Toggles debug mode.
   * TODO: We need to show debug information per layer, such as the current time, name, and duration.
   * We also need to show other global information such as memory consumption, etc.
   */
  /*
 private toggleDebug() {
   if (this.debugLayer) {
     this.el.removeChild(this.debugLayer);
     delete this.debugLayer;
   } else {
     this.debugLayer = document.createElement("div");
     this.debugLayer.style.position = "absolute";
     this.debugLayer.style.left = "0";
     this.debugLayer.style.top = "0";
     this.debugLayer.style.width = "100%";
     this.debugLayer.style.height = "100%";
     this.debugLayer.style.zIndex = "10000";
     this.el.appendChild(this.debugLayer);

     // Add element for displaying current layer info
     this.debugLayer.innerHTML = `<div style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); color: white; font-size: 1.5em; text-align: center;">No layer</div>`;
   }
 }
 */

  seek(_offset: number) {
    const duration = this.duration();
    const offset =
      Number.isFinite(duration) && duration > 0
        ? ((_offset % duration) + duration) % duration
        : 0;
    this.time = offset;

    let result: [number, number] = [offset, duration];
    const item = this.findLayer(offset);
    if (item) {
      const { layer, offset: relativeOffset = 0 } = item;
      return layer.seek(relativeOffset).pipe(
        switchMap(() => {
          result = [offset, duration];
          return of(result);
        })
      );
    }
    return of(result);
  }

  show(renderer: Renderer) {
    const item = this.findLayer(this.time);
    if (item) {
      const { layer, offset = 0 } = item;
      // A blocked item may never get ready; let playback start so the item
      // can be skipped.
      return race(
        renderer.show(layer, offset),
        layer.blocked$().pipe(
          filter((block) => !!block),
          take(1),
          map(() => 'layer:show:blocked')
        )
      );
    }
    return of('end');
  }

  unload(): void {
    this.layers.forEach((layer) => layer.unload());
  }

  private findLayer(offset: number) {
    const layersWithOffsets = this.getLayersWithOffsets();
    for (let i = 0; i < layersWithOffsets.length; i++) {
      const item = layersWithOffsets[i];
      if (offset >= item.start && offset < item.end) {
        return {
          index: i,
          offset: offset - item.start,
          duration: item.duration,
          layer: item.layer,
          layersWithOffsets,
        };
      }
    }
  }

  layerDurations(): number[] {
    return this.layers.map((layer) => layer.duration());
  }

  duration(): number {
    return this.layers.reduce((acc, entry) => acc + entry.duration(), 0);
  }

  public get position(): number {
    return this.time;
  }

  add(entry: Layer, index?: number): Playlist {
    if (index) {
      this.layers.splice(index, 0, entry);
    } else {
      this.layers.push(entry);
    }
    return this;
  }

  remove(entry: Layer): Playlist {
    const index = this.layers.indexOf(entry);
    if (index > -1) {
      this.layers.splice(index, 1);
    }
    return this;
  }

  get length(): number {
    return this.layers.length;
  }
}
