import { ResourceManager } from '@castmill/cache';

import { Status } from './playable';
import { Layer } from './layer';
import { EventEmitter } from 'eventemitter3';
import { of, from, Observable } from 'rxjs';
import {
  concatMap,
  map,
  repeat,
  share,
  takeWhile,
  tap,
  switchMap,
} from 'rxjs/operators';
import { Renderer } from './renderer';
import { JsonPlaylist } from './';
import { PlayerGlobals } from './interfaces/player-globals.interface';

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
    globals: PlayerGlobals
  ) {
    const playlist = new Playlist(json.name, resourceManager);
    const layers = json.items || [];

    for (let i = 0; i < layers.length; i++) {
      const layer = Layer.fromJSON(json.items[i], resourceManager, globals);
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

  private getLayersWithOffsets(): {
    start: number;
    end: number;
    duration: number;
    layer: Layer;
  }[] {
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
      const playlistTimer$ = timer$.pipe(
        map((value) => value % duration),
        tap((value) => {
          this.time = value;
        }),
        share()
      );

      const playing$ = from(elements).pipe(
        concatMap((element) => {
          const layerOffset = first ? offset : 0;
          current = element.layer;
          first = 0;
          return this.playLayer(
            renderer,
            playlistTimer$,
            element.layer,
            layerOffset,
            element.start,
            element.end
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

  private playLayer(
    renderer: Renderer,
    timer$: Observable<number>,
    layer: Layer,
    layerOffset: number,
    start: number,
    end: number
  ): Observable<string | number> {
    const volume = 100;
    return renderer.play(
      layer,
      timer$.pipe(
        takeWhile((value) => value >= start && value < end),
        map((value) => value - start),
        share()
      ),
      layerOffset,
      volume
    );
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
    const offset = _offset % (duration + 1);
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
      return renderer.show(layer, offset);
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
