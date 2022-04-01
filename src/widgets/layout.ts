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

import { from, Observable, merge } from "rxjs";
import { mergeMap, max } from "rxjs/operators";

import { Playlist, Renderer, JsonLayout, Widget } from "../";

export class Layout extends Widget {
  private items: { renderer: Renderer; playlist: Playlist }[] = [];

  constructor(public name: string, opts?: { duration: number }) {
    super(opts);
  }

  static async fromLayoutJSON(json: JsonLayout) {
    const layout = new Layout(json.name, json.args);

    const items = json.items;
    items.forEach(async (item) => {
      const playlist = await Playlist.fromJSON(item.playlist);
      layout.add({
        css: item.css,
        playlist,
      });
    });

    return layout;
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

  toggleDebug() {
    this.items.map(({ renderer, playlist }) => {
      renderer.toggleDebug();
    });
  }

  add(container: { css: Partial<CSSStyleDeclaration>; playlist: Playlist }) {
    const containerElement = document.createElement("div");
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

  duration(): Observable<number> {
    const durations$ = merge(
      ...this.items.map((item) => item.playlist.duration())
    );

    return durations$.pipe(max());
  }

  play(timer$: Observable<number>): Observable<string | number> {
    return from(this.items).pipe(
      mergeMap((item) =>
        item.playlist.play(item.renderer, timer$, { loop: true })
      )
    );
  }

  seek(offset: number): Observable<[number, number]> {
    return merge(...this.items.map((item) => item.playlist.seek(offset)));
  }
}
