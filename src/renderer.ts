/**
 * renderer.ts
 * (c) Optimal Bits Sweden 2011-2021
 *
 */

/**
 * Renderer
 *
 * This class renders the content on the DOM.
 */
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
import { merge, Observable, of } from "rxjs";
import { concatMap, finalize } from "rxjs/operators";
import { CrossFade } from "./transitions/crossfade";
import { Transition } from "./transitions/transition.interface";

var PLAY_TIMEOUT = 5000; //to prevent infinite waiting for misbehaving layers.

/*
 var transitions = [
   Transitions.crossFade,
   Transitions.zoom,
   Transitions.stretch
 ];
 */
export class Renderer {
  public el: HTMLElement;
  public volume: number = 0;

  private currentLayer?: Layer;

  private loadingLayer$?: Observable<string>;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  /**
   * Shows the layer, i.e. it displays it on the screen, performing an optional transition animation
   * between previous and this new layer.
   * @param layer
   * @param offset
   */
  show(layer: Layer, offset: number) {
    var prevLayer = this.currentLayer;

    layer.seek(offset);
    //
    // Put the previous layer on the front.
    //
    // Handles special case with playlists containing only 1 item.
    if (prevLayer) {
      if (prevLayer !== layer) {
        prevLayer.el.style.zIndex = "1000";
      } else {
        // codesmell, this is needed so that the playlists in a layout are rendered
        // return of("shown");
        return layer.show(offset);
      }
    }

    const displayCss = layer.el.style.display;
    layer.el.style.zIndex = "0";
    this.el.appendChild(layer.el);

    //
    // Load the new layer & Replace the old one
    //
    this.currentLayer = layer;
    this.loadingLayer$ = layer.show(offset).pipe(
      concatMap(() => {
        return this.performTransition(1000, layer, prevLayer, new CrossFade());
      }),
      finalize(() => {
        if (prevLayer) {
          prevLayer.unload();
          prevLayer.el.parentElement?.removeChild(prevLayer.el);
        }
        layer.el.style.display = displayCss;
      })
    );
    return this.loadingLayer$;
  }

  performTransition(
    duration: number,
    layer: Layer,
    prevLayer?: Layer,
    transition?: Transition
  ) {
    if (prevLayer) {
      if (transition) {
        return transition?.run(prevLayer, layer, {
          duration,
        });
      } else {
        return of("transition:end");
      }
    } else {
      return of("end");
    }
  }

  play(
    layer: Layer,
    timer$: Observable<number>,
    offset: number,
    volume: number
  ) {
    return merge(this.show(layer, offset), layer.play(timer$));
  }

  seek(offset: number) {
    return this.currentLayer?.seek(offset);
  }

  async clean() {
    // Note, what if we are playing when this is called?
    this.el.parentElement?.removeChild(this.el);
    /*
    this.stop();
    if (this.currentLayer) {
      this.currentLayer.unload();
      delete this.currentLayer;
    }
    this.shown = false;
    */
  }
}
