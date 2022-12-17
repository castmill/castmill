import { JSX } from "solid-js";

import { ResourceManager } from "@castmill/cache";
import { from, merge, of } from "rxjs";
import { mergeMap, map, last } from "rxjs/operators";
import { TimelineWidget } from "../timeline-widget";

import { render } from "solid-js/web";
import { Template } from "./components/template";
import { TemplateComponentTypeUnion } from "./components/item";

/**
 * Template Widget
 *
 * This widget allows to create a custom widget using a template.
 *
 */
export class TemplateWidget extends TimelineWidget {
  private fontFaces: { [key: string]: Promise<FontFace> } = {};
  private medias: { [key: string]: string } = {};
  private loaded: boolean = false;

  constructor(
    resourceManager: ResourceManager,
    private opts: {
      name: string;
      template: TemplateComponentTypeUnion;
      model: any;
      fonts?: { url: string; name: string }[];
      medias?: string[];
      style: JSX.CSSProperties;
      classes?: string;
    }
  ) {
    super(resourceManager, opts);
  }

  /**
   *
   * Loads all the required assets by the template, such as
   * fonts, images, etc.
   *
   * @returns
   */
  private load() {
    return merge(this.loadFonts(), this.loadMedias()).pipe(last());
  }

  private loadFonts() {
    return from(this.opts.fonts || []).pipe(
      mergeMap((font) =>
        from(this.resourceManager.getMedia(font.url)).pipe(
          map((url) => {
            if (!this.fontFaces[font.name]) {
              this.fontFaces[font.name] = this.loadFont(
                font.name,
                url || font.url
              );
            }
            return of(this.fontFaces[font.name]);
          })
        )
      )
    );
  }

  private loadFont(name: string, url: string) {
    const fontFace = new FontFace(name, `url(${url})`);

    return fontFace.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
      return loadedFace;
    });
  }

  private loadMedias() {
    return from(this.opts.medias || []).pipe(
      mergeMap((url) =>
        from(this.resourceManager.getMedia(url)).pipe(
          map((cachedUrl) => {
            this.medias[url] = cachedUrl || url;
            return of("media:cached");
          })
        )
      )
    );
  }

  async unload() {
    // Note: there is a risk here that we remove a font that is still in use by another widget.
    // We would need to either keep track of the fonts in use or add a unique prefix to the font name.
    const fontFaceSet = document.fonts;
    const fontFacesNames = Object.keys(this.fontFaces);

    for (let i = 0; i < fontFacesNames.length; i++) {
      const fontFaceName = fontFacesNames[i];
      const fontFace = await this.fontFaces[fontFaceName];
      fontFaceSet.delete(fontFace);
      delete this.fontFaces[fontFaceName];
    }
  }

  show(el: HTMLElement, offset: number) {
    // Note: we need to think how data is refreshed when the model changes.

    const basetime = Date.now();

    return this.load().pipe(
      map((x) => {
        if (el.children.length === 0) {
          render(
            () =>
              Template({
                name: this.opts.name,
                root: this.opts.template,
                model: this.opts.model,
                style: this.opts.style,
                timeline: this.timeline,
                mediasMap: this.medias,
              }),
            el
          );
        }
        this.seek(offset + (Date.now() - basetime));
        this.loaded = true;
        return "template-widget:shown";
      })
    );
  }

  mimeType(): string {
    return "template/widget";
  }
}
