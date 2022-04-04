/**
 * renderer.ts
 * (c) Castmill AB 2011-2022
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
 * Basically a Renderer manages one DOM element and the content just beneath it.
 * It can also be seen as a playables orchestrator for a given element.
 *
 */
import { Layer } from "./layer";
import { merge, Observable, of } from "rxjs";
import { concatMap, finalize, switchMap } from "rxjs/operators";

export class Renderer {
  public el: HTMLElement;
  public volume: number = 0;

  private currentLayer?: Layer;

  private loadingLayer$?: Observable<string>;

  private debugLayer?: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  toggleDebug() {
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
      this.debugLayer.style.color = "white";
      this.debugLayer.style.fontSize = "1.5em";
      this.el.appendChild(this.debugLayer);

      // Add element for displaying current layer info
      /*
      this.debugLayer.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); text-align: center;">
          No layer
        </div>`;
      */
    }
  }

  private updateDebug(text: string) {
    if (this.debugLayer) {
      this.debugLayer.innerHTML = `
      <div style="position: absolute; bottom: 0;background: rgba(0,0,0,0.5); text-align: center;">
        ${text}
      </div>`;
    }
  }

  /**
   * Shows the layer, i.e. it displays it on the screen, performing an optional transition animation
   * between previous and this new layer.
   * @param layer
   * @param offset
   */
  show(layer: Layer, offset: number) {
    const prevLayer = this.currentLayer;

    return layer.seek(offset).pipe(
      switchMap(() => {
        this.updateDebug(layer.name);

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

        /*
        if (this.debugLayer) {
          this.debugLayer.innerHTML = `playing ${layer.name}`;
        }
        */

        this.loadingLayer$ = layer.show(offset).pipe(
          concatMap(() => {
            // There is a bug if the transition is shorter than the duration of the layer.
            // We should make sure this can never happen.
            return this.performTransition(layer, prevLayer);
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
      })
    );
  }

  performTransition(layer: Layer, prevLayer?: Layer) {
    if (prevLayer) {
      if (layer.transition) {
        return layer.transition?.run(prevLayer, layer);
      } else {
        // We set opacity to 1 since some older transition may have changed it to 0
        // Should not be needed if the transition restores the style correctly.
        layer.el.style.opacity = "1";
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
