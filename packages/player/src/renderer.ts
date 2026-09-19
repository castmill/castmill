/**
 * renderer.ts
 * (c) Castmill AB 2022
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
import { Layer } from './layer';
import { Transition } from './transitions/transition';
import { combineLatest, Observable, of } from 'rxjs';
import { finalize, switchMap, tap, map } from 'rxjs/operators';

/**
 * Viewport
 *
 * Units must be in percentage. Where 100% means the whole element.
 */
export interface Viewport {
  left: number;
  top: number;
  height: number;
  width: number;
}
export class Renderer {
  public el: HTMLElement;
  public volume: number = 0;

  private currentLayer?: Layer;
  private pendingLayer?: Layer;
  private currentTransition?: Transition;

  private debugLayer?: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  setViewport(viewport: Viewport) {
    const { width, height } = this.el.getBoundingClientRect();

    const useTransform = false;
    if (useTransform) {
      const scale = 100 / viewport.width;
      this.el.style.transform = `scale(${scale}) translate(${
        25 - viewport.left
      }%, ${25 - viewport.top}%)`;

      this.el.style.clip = `rect(0px, ${width / scale}px, ${
        height / scale
      }px, 0px)`;
      this.el.style.webkitMaskClip = `rect(0px, ${width / scale}px, ${
        height / scale
      }px, 0px)`;
      this.el.style.clipPath = `inset(0px ${width / scale}px ${
        height / scale
      }px 0px)`;
    } else {
      const newWidth = 100 * (100 / viewport.width);
      const newHeight = 100 * (100 / viewport.height);

      const newLeft = -(viewport.left / 100) * newWidth;
      const newTop = -(viewport.top / 100) * newHeight;

      this.el.style.width = `${newWidth}%`;
      this.el.style.height = `${newHeight}%`;
      this.el.style.left = `${newLeft}%`;
      this.el.style.top = `${newTop}%`;

      const clipTop = height * (viewport.top / viewport.height);
      const clipLeft = width * (viewport.left / viewport.width);
      const clipRight = width + clipLeft;
      const clipBottom = height + clipTop;

      this.el.style.clip = `rect(${clipTop}px, ${clipRight}px, ${clipBottom}px, ${clipLeft}px)`;
      this.el.style.webkitMaskClip = `rect(${clipTop}px, ${clipRight}px, ${clipBottom}px, ${clipLeft}px)`;

      const clipPathBottom =
        (height * 100) / viewport.height - (clipTop + height);
      const clipPathRight = (width * 100) / viewport.width - (clipLeft + width);

      this.el.style.clipPath = `inset(${clipTop}px ${clipPathRight}px ${clipPathBottom}px ${clipLeft}px)`;

      this.el.dataset.clip = JSON.stringify({
        x: clipLeft,
        width,
        y: clipTop,
        height,
      });
    }
  }

  toggleDebug() {
    if (this.debugLayer) {
      this.el.removeChild(this.debugLayer);
      delete this.debugLayer;
    } else {
      this.debugLayer = document.createElement('div');
      this.debugLayer.style.position = 'absolute';
      this.debugLayer.style.left = '0';
      this.debugLayer.style.top = '0';
      this.debugLayer.style.width = '100%';
      this.debugLayer.style.height = '100%';
      this.debugLayer.style.zIndex = '10000';
      this.debugLayer.style.color = 'white';
      this.debugLayer.style.fontSize = '1.5em';
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

  private removeLayer(layer?: Layer) {
    if (!layer) {
      return;
    }

    layer.unload();
    layer.el.parentElement?.removeChild(layer.el);
  }

  private clearPendingLayer(layer = this.pendingLayer) {
    if (!layer) {
      return;
    }

    if (this.pendingLayer === layer) {
      delete this.pendingLayer;
    }

    if (layer !== this.currentLayer) {
      this.removeLayer(layer);
    }
  }

  private setPendingLayer(layer: Layer) {
    const previousPendingLayer = this.pendingLayer;

    if (previousPendingLayer && previousPendingLayer !== layer) {
      this.clearPendingLayer(previousPendingLayer);
    }

    this.pendingLayer = layer;
  }

  /**
   * Shows the layer, i.e. it displays it on the screen, performing an optional transition animation
   * between previous and this new layer.
   * @param layer
   * @param offset
   */
  show(layer: Layer, offset: number) {
    // It is annoying that seek and show are separate methods, in this case.
    // if the layout widget supported show with offset we could skip it.
    const prevLayer = this.currentLayer;
    if (prevLayer) {
      prevLayer.el.style.zIndex = '1000';
      if (prevLayer === layer) {
        if (this.pendingLayer && this.pendingLayer !== layer) {
          this.clearPendingLayer(this.pendingLayer);
        }
        return of('layer:show:end');
      }
    }

    layer.el.style.zIndex = '0';
    layer.el.style.visibility = 'hidden';
    this.setPendingLayer(layer);
    this.el.appendChild(layer.el);

    return layer.show(offset).pipe(
      finalize(() => {
        if (this.pendingLayer !== layer && this.currentLayer !== layer) {
          return;
        }

        layer.el.style.visibility = 'visible';

        // If we have a current transition and but a new one is requested
        // we need to reset the current transition.
        if (this.currentTransition != layer.transition) {
          this.currentTransition?.reset();
          // We will only apply the transition if there is a previous layer
          if (prevLayer) {
            this.currentTransition = layer.transition;
            this.currentTransition?.init(prevLayer, layer);
          }
        }

        if (prevLayer) {
          const transition = layer.transition;
          if (transition) {
            if (offset < transition.duration) {
              transition.seek(offset);
              return;
            }
            transition.seek(transition.duration);
          }
          this.removeLayer(prevLayer);
        }
        this.currentLayer = layer;
        if (this.pendingLayer === layer) {
          delete this.pendingLayer;
        }
      })
    );
  }

  private performTransition(layer: Layer, offset: number, prevLayer?: Layer) {
    let observable$;
    if (prevLayer && prevLayer != layer && layer.transition) {
      if (this.currentTransition != layer.transition) {
        this.currentTransition?.reset();
        layer.transition.init(prevLayer, layer);
        this.currentTransition = layer.transition;
      }
      observable$ = layer.transition.run(offset);
    } else {
      observable$ = of('play:transition:end');
    }
    return observable$.pipe(
      tap(() => {
        if (this.pendingLayer !== layer && this.currentLayer !== layer) {
          return;
        }

        if (prevLayer && prevLayer != layer) {
          this.removeLayer(prevLayer);
        }
        this.currentLayer = layer;
        if (this.pendingLayer === layer) {
          delete this.pendingLayer;
        }
      })
    );
  }

  play(
    layer: Layer,
    timer$: Observable<number>,
    offset: number,
    volume: number
  ) {
    layer.el.style.zIndex = '0';
    const prevLayer = this.currentLayer;
    if (prevLayer) {
      prevLayer.el.style.zIndex = '1000';
    }

    return layer.seek(offset).pipe(
      switchMap(() => {
        // We need to append BEFORE we show, so that Autofittext works properly.
        this.setPendingLayer(layer);
        this.el.appendChild(layer.el);
        return layer.show(offset).pipe(
          switchMap(() => {
            return combineLatest([
              layer.play(timer$),
              this.performTransition(layer, offset, this.currentLayer),
            ]);
          })
        );
      }),
      map(() => 'play:layer:end')
    );
  }

  seek(offset: number) {
    return this.currentLayer?.seek(offset);
  }

  clear() {
    this.currentTransition?.reset();
    delete this.currentTransition;

    const currentLayer = this.currentLayer;
    if (currentLayer) {
      this.removeLayer(currentLayer);
      delete this.currentLayer;
    }

    const pendingLayer = this.pendingLayer;
    if (pendingLayer && pendingLayer !== currentLayer) {
      this.clearPendingLayer(pendingLayer);
    }
    delete this.pendingLayer;
  }

  getCurrentLayer() {
    return this.currentLayer;
  }

  async clean() {
    // Note, what if we are playing when this is called?
    this.el.parentElement?.removeChild(this.el);
    if (this.currentLayer) {
      this.currentLayer.unload();
      delete this.currentLayer;
    }
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
