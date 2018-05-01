/**
 *
 * This module helps in playing content in order without risk for
 * overlapping content and other issues. It also allows to use
 * transitions between elements.
 *
 * Basically a play-server manages one DOM element and the content just beneath it.
 * It can also be seen as a playables orchestrator in a given element.
 *
 */
import { Layer } from "./layer";
import { extend } from "lodash";

var PLAY_TIMEOUT = 5000; //to prevent infinite waiting for misbehaving layers.

/*
var transitions = [
  Transitions.crossFade,
  Transitions.zoom,
  Transitions.stretch
];
*/
export class PlayServer {
  private el: HTMLElement;
  public volume: number = 0;

  private currentLayer!: Layer;
  private shown: boolean = false;

  constructor(el: HTMLElement, opts?: {}) {
    extend(this, opts);
    this.el = el;
  }

  private async show(
    layer: Layer,
    offset: number,
    performTransition: boolean
  ): Promise<void> {
    var prevLayer = this.currentLayer;
    //
    // Put the previous layer in front.
    //
    if (prevLayer) {
      if (prevLayer !== layer) {
        $(prevLayer.el).css({ "z-index": 1000 });
      } else {
        return Promise.resolve(void 0);
      }
    }

    $(layer.el).css({ "z-index": 0 });
    layer.el.style.display = "none";
    this.el.appendChild(layer.el);

    //
    // Load the new layer
    // Not sure finally is the proper one here.
    //
    this.currentLayer = layer;
    try {
      await layer.load();
      await layer.seek(offset || 0);
    } catch (err) {
      throw err;
    } finally {
      layer.el.style.display = "block";
      if (prevLayer && prevLayer !== layer) {
        prevLayer.unload();
        this.el.removeChild(prevLayer.el);
      }
    }
  }

  async play(
    layer: Layer,
    offset: number,
    volume: number,
    performTransition: boolean
  ) {
    await this.show(layer, offset, performTransition);
    return layer.play();
  }

  seek(offset: number): Promise<void> {
    return this.currentLayer.seek(offset);
  }

  /**
      Stop whatever is currently being played.
    */
  stop() {
    //this.showing && this.showing.cancel();
    this.currentLayer && this.currentLayer.stop();
  }

  clean() {
    this.stop();
    if (this.currentLayer) {
      this.currentLayer.unload();
      delete this.currentLayer;
    }
    this.shown = false;
  }
}
