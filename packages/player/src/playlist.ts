import { ResourceManager } from '@castmill/cache';

import { Status } from './playable';
import { Layer } from './layer';
import { EventEmitter } from 'eventemitter3';
import { of, from, race, Observable, Subscription } from 'rxjs';
import {
  concatMap,
  filter,
  take,
  map,
  repeat,
  share,
  takeWhile,
  tap,
  switchMap,
} from 'rxjs/operators';
import { Renderer } from './renderer';
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

/**
 * Maps the timer onto playlist time. The mapping can be shifted forward to
 * skip an item, and held while the current item is blocked so the item still
 * starts from its beginning. The shift lasts for one `play` call.
 */
class PlaylistClock {
  private skew = 0;
  private held?: number;
  private last = 0;

  // `start` is the playlist time playback starts at, so an item that is
  // already blocked before the first tick is held at its start offset.
  constructor(
    private readonly duration: number,
    start = 0
  ) {
    this.last = this.wrap(start);
  }

  map(value: number): number {
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
    return ((value % this.duration) + this.duration) % this.duration;
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

  constructor(
    public name: string,
    private resourceManager: ResourceManager
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
    const playlist = new Playlist(json.name, resourceManager);
    const items = json.items || [];

    for (let i = 0; i < items.length; i++) {
      const layer = Layer.fromJSON(items[i], resourceManager, globals);
      playlist.add(layer);
    }
    return playlist;
  }

  play(
    renderer: Renderer,
    timer$: Observable<number>,
    opts?: { loop?: boolean }
  ) {
    return this.playLayers(renderer, timer$, opts ? opts : {});
  }

  toggleDebug() {
    this.layers.map((layer) => layer.toggleDebug());
  }

  private getLayersWithOffsets(): LayerWithOffsets[] {
    // Compute offsets for every layer
    let end = 0;
    return this.layers.map((layer) => {
      const duration = layer.duration();
      const start = end;
      end += duration;
      const result = {
        start,
        end,
        duration,
        layer,
      };
      return result;
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
      let current: Layer;
      const duration = layersWithOffsets.reduce(
        (acc, item) => acc + item.duration,
        0
      );
      const clock = new PlaylistClock(duration, this.time);
      const skips = { count: 0 };
      const playlistTimer$ = timer$.pipe(
        map((value) => clock.map(value)),
        tap((value) => {
          this.time = value;
        }),
        share()
      );

      const playing$ = from(elements).pipe(
        concatMap((element, i) => {
          const layerOffset = first ? offset : 0;
          current = element.layer;
          first = 0;
          const next =
            i + 1 < elements.length
              ? elements[i + 1]
              : loop
                ? elements[0]
                : undefined;
          return this.skipWhenBlocked(
            renderer,
            clock,
            playlistTimer$,
            element,
            skips,
            layersWithOffsets.length,
            this.playLayer(
              renderer,
              playlistTimer$,
              element.layer,
              layerOffset,
              element.start,
              element.end,
              (elapsed) =>
                this.updateDebugOverlay(renderer, elapsed, element, next, {
                  index: layersWithOffsets.indexOf(element),
                  count: layersWithOffsets.length,
                  duration,
                })
            )
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

  /**
   * Plays an item, holding the playlist clock while the item is blocked. An
   * item blocked for BLOCKED_ITEM_SKIP_MS is skipped. When every item has
   * been skipped in a row, skipping would only cycle through blocked items,
   * so the area is left empty and the item plays as soon as it can.
   */
  private skipWhenBlocked(
    renderer: Renderer,
    clock: PlaylistClock,
    timer$: Observable<number>,
    element: LayerWithOffsets,
    skips: { count: number },
    count: number,
    play$: Observable<string | number>
  ): Observable<string | number> {
    return new Observable<string | number>((subscriber) => {
      let skipTimer: ReturnType<typeof setTimeout> | undefined;
      let waiting = false;
      let playing: Subscription | undefined;
      const layer = element.layer;

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
          clock.jumpTo(element.end);
          playing?.unsubscribe();
          subscriber.complete();
        } else {
          waiting = true;
          renderer.blank(layer);
        }
      };

      let block: PlayerRuntimeError | undefined;
      const onBlocked = (value: PlayerRuntimeError | undefined) => {
        block = value;
        if (value) {
          clock.hold(element.start, element.end);
          if (!waiting && skipTimer === undefined) {
            skipTimer = setTimeout(onBlockExpired, BLOCKED_ITEM_SKIP_MS);
          }
        } else {
          stopTimer();
          clock.release();
        }
      };

      // Keeps the clock running while the item waits to be shown, so holds
      // and skips start from the current time.
      const ticking = timer$.subscribe();
      const blocked = layer.blocked$().subscribe(onBlocked);
      playing = play$.subscribe({
        next: (value) => subscriber.next(value),
        error: (error) => subscriber.error(error),
        complete: () => {
          skips.count = 0;
          subscriber.complete();
        },
      });

      return () => {
        stopTimer();
        blocked.unsubscribe();
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
    start: number,
    end: number,
    onTick?: (elapsed: number) => void
  ): Observable<string | number> {
    const volume = 100;
    return renderer.play(
      layer,
      timer$.pipe(
        takeWhile((value) => value >= start && value < end),
        map((value) => value - start),
        tap((elapsed) => onTick?.(elapsed)),
        share()
      ),
      layerOffset,
      volume
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
    }: { index: number; count: number; duration: number }
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
