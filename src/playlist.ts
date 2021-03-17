import { Status } from "./playable";
import { Layer } from "./layer";
import { EventEmitter } from "eventemitter3";
import { of, from, Observable } from "rxjs";
import { concatMap, map, repeat, share, takeWhile, tap } from "rxjs/operators";
import { Renderer } from "./renderer";

export class Playlist extends EventEmitter {
  public layers: Layer[] = [];

  time: number = 0;

  status: Status = Status.NotReady;

  constructor(public name: string) {
    super();
  }

  play(
    renderer: Renderer,
    timer$: Observable<number>,
    opts?: { loop?: boolean }
  ) {
    return this.playLayers(renderer, timer$, opts ? opts : {});
  }

  private playLayers(
    renderer: Renderer,
    timer$: Observable<number>,
    { loop = false }
  ) {
    const { layer, offset: relativeOffset = 0, index } = this.findLayer(
      this.time
    );
    if (layer) {
      // The first layer must be seeked at a relative offset, the rest after it with offset 0.
      let first = 1;

      // Compute offsets for every layer
      let end = 0;
      const layersWithOffsets = this.layers.map((layer) => {
        const start = end;
        end += layer.duration();
        const result = {
          start,
          end,
          layer,
        };

        return result;
      });

      // Rotate array (so that we can have a complete array to loop with from current item)
      const elements = layersWithOffsets
        .slice(index)
        .concat(layersWithOffsets.slice(0, index));

      // We start playing from the found layer at the current offset.
      let current: Layer;
      const duration = this.duration();
      const playlistTimer$ = timer$.pipe(
        map((value) => value % duration),
        tap((value) => (this.time = value)),
        share()
      );

      const playing$ = from(elements).pipe(
        concatMap((element) => {
          const layerOffset = first ? relativeOffset : 0;
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
      return of("end");
    }
  }

  private playLayer(
    renderer: Renderer,
    timer$: Observable<number>,
    layer: Layer,
    layerOffset: number,
    start: number,
    end: number
  ) {
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

  seek(offset: number) {
    offset = offset % (this.duration() + 1);
    this.time = offset;
    this.emit("offset", offset);
    const { layer, offset: relativeOffset = 0 } = this.findLayer(offset);

    if (layer) {
      return layer.seek(relativeOffset);
    }
  }

  show(renderer: Renderer) {
    const { layer, offset = 0 } = this.findLayer(this.time);
    if (layer) {
      return renderer.show(layer, offset);
    }
    return of("end");
  }

  unload(): void {
    this.layers.forEach((layer) => layer.unload());
  }

  // Finds layer at given offset and relative offset within that layer.
  private findLayer(offset: number) {
    let currOffset = 0;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const duration = layer.duration();
      if (currOffset + duration >= offset) {
        return { index: i, offset: offset - currOffset, duration, layer };
      }
      currOffset += duration;
    }
    return {};
  }

  duration(): number {
    var totalDuration = 0;

    this.layers.map(async (entry) => {
      const duration = entry.duration();
      totalDuration += duration;
    });

    return totalDuration;
  }

  public get position(): number {
    return this.time;
  }

  add(entry: Layer, index?: number): void {
    if (index) {
      this.layers.splice(index, 0, entry);
    } else {
      this.layers.push(entry);
    }
  }
}
