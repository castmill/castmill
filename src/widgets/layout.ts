/**
 *
 * A Layout defines areas in the screen where content can be played.
 * A layout can be as simple as one full screen, or it can be composed
 * of dozens of different areas, overlapping or not.
 * Every layout area has a Playlist and a Renderer that can play content independently of the
 * other areas.
 *
 *  A Layout can be part of other layouts if wrapped in a Layer.
 *  playlists as any other layer.
 */

import { Widget } from "./";
import { from, Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { Playlist } from "../playlist";
import { Renderer } from "../renderer";

export class Layout extends Widget {
  private items: { renderer: Renderer; playlist: Playlist }[] = [];

  constructor(public name: string, opts?: { duration: number }) {
    super(opts);
  }

  show(el: HTMLElement) {
    return from(this.items).pipe(
      mergeMap((item) => {
        el.appendChild(item.renderer.el);
        return item.playlist.show(item.renderer);
      })
    );
  }

  unload(): void {
    this.items.map((item) => {
      item.playlist.layers.forEach((item) => item.unload());
      item.renderer.clean();
    });
  }

  add(container: { css: Partial<CSSStyleDeclaration>; playlist: Playlist }) {
    var containerElement = document.createElement("div");
    containerElement.style.position = "absolute";

    const css = container.css;
    for (let key in css) {
      const styleProperty = css[key];
      if (styleProperty) {
        containerElement.style[key] = styleProperty;
      }
    }
    this.items.push({
      renderer: new Renderer(containerElement),
      playlist: container.playlist,
    });
  }

  duration(): number {
    return this.items.reduce((maxDuration, container) => {
      const duration = container.playlist.duration();
      if (duration > maxDuration) {
        return duration;
      }
      return maxDuration;
    }, 0);
  }

  play(timer$: Observable<number>) {
    return from(this.items).pipe(
      mergeMap((item) =>
        item.playlist.play(item.renderer, timer$, { loop: true })
      )
    );
  }

  seek(offset: number) {
    this.items.forEach((item) => {
      return item.playlist.seek(offset);
    });
  }
}
