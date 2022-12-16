/**
 *
 * A Layout defines areas in the screen where content can be played.
 * A layout can be as simple as one full screen, or it can be composed
 * of dozens of different areas, overlapping or not.
 * Every layout area has a Playlist and a Renderer that can play content independently of the
 * other areas.
 *
 */

import { ResourceManager } from "@castmill/cache";
import { Observable, merge, combineLatest } from "rxjs";
import { max, map } from "rxjs/operators";

import { Playlist, Renderer, JsonLayout, Widget } from "../";

export class Layout extends Widget {
  private items: { renderer: Renderer; playlist: Playlist }[] = [];
  private el?: HTMLElement;

  constructor(
    public name: string,
    resourceManager: ResourceManager,
    opts?: { duration: number }
  ) {
    super(resourceManager, opts);
  }

  static async fromLayoutJSON(
    json: JsonLayout,
    resourceManager: ResourceManager
  ) {
    const layout = new Layout(json.name, resourceManager, json.args);

    const items = json.items;
    await Promise.all(
      items.map(async (item) => {
        const playlist = await Playlist.fromJSON(
          item.playlist,
          resourceManager
        );
        layout.add({
          css: item.css,
          playlist,
        });
      })
    );

    return layout;
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

  show(el: HTMLElement) {
    this.el = el;
    this.items.forEach((item) => {
      el.appendChild(item.renderer.el);
    });
    return combineLatest(
      this.clipLayouts().map((item) => item.playlist.show(item.renderer))
    ).pipe(map((values) => values[0]));
  }

  play(timer$: Observable<number>): Observable<string | number> {
    return combineLatest(
      this.clipLayouts().map((item) =>
        item.playlist.play(item.renderer, timer$, { loop: true })
      )
    ).pipe(map((values) => values[0]));
  }

  seek(offset: number): Observable<[number, number]> {
    return combineLatest(
      this.items.map((item) => item.playlist.seek(offset))
    ).pipe(map((values) => values[0]));
  }

  private findParentClip(el: HTMLElement): HTMLElement | null {
    if (el.parentElement) {
      const parent = el.parentElement;
      if (parent.dataset.clip) {
        return parent;
      } else {
        return this.findParentClip(parent);
      }
    } else {
      return null;
    }
  }

  private clipLayouts() {
    const el = this.el;
    if (!el) {
      return this.items;
    }

    const parentClipElement = this.findParentClip(el);
    if (parentClipElement) {
      const parentRect = JSON.parse(parentClipElement.dataset.clip!);
      const { x, y } = parentClipElement.getBoundingClientRect();

      return this.items.filter((item) => {
        const itemRect = item.renderer.el.getBoundingClientRect();
        return this.areRectanglesIntersecting(itemRect, parentRect, x, y);
      });
    } else {
      return this.items;
    }
  }

  private areRectanglesIntersecting(
    aRect: DOMRect,
    bRect: DOMRect,
    offsetX: number,
    offsetY: number
  ): boolean {
    let { x: x0, width: w0, y: y0, height: h0 } = aRect;
    const { x: x1, width: w1, y: y1, height: h1 } = bRect;

    x0 -= offsetX;
    y0 -= offsetY;

    return !(x0 >= x1 + w1 || x0 + w0 <= x1 || y0 >= y1 + h1 || y0 + h0 <= y1);
  }
}
