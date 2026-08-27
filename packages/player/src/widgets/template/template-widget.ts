import { JSX } from 'solid-js';

import { ResourceManager } from '@castmill/cache';
import { Observable, forkJoin, from, merge, of } from 'rxjs';
import { mergeMap, map, switchMap } from 'rxjs/operators';
import { TimelineWidget } from '../timeline-widget';

import { render } from 'solid-js/web';
import { Template, TemplateComponent } from './template';
import { TemplateConfig } from './binding';
import { JsonWidget } from '../../interfaces';
import { JsonWidgetConfig } from '../../interfaces/json-widget-config.interface';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

/**
 * Template Widget
 *
 * This widget allows to create a custom widget using a template.
 *
 */

export interface TemplateWidgetOptionsOld {
  name: string;
  template: any; // We specify any, but it should be JsonTemplate.
  config: TemplateConfig;
  fonts?: { url: string; name: string }[];
  medias: string[];
  style: JSX.CSSProperties;
  classes?: string;
}
export interface TemplateWidgetOptions {
  widget: JsonWidget;
  config: JsonWidgetConfig;
  fonts?: { url: string; name: string }[];
  medias?: string[];
  style?: JSX.CSSProperties;
  classes?: string;
  globals: PlayerGlobals;
}

export class TemplateWidget extends TimelineWidget {
  private fontFaces: { [key: string]: Promise<FontFace> } = {};
  private medias: { [key: string]: string } = {};
  private template: TemplateComponent;
  private displayDuration?: number;

  constructor(
    resourceManager: ResourceManager,
    private opts: TemplateWidgetOptions
  ) {
    super(resourceManager, opts);

    this.template = TemplateComponent.fromJSON(
      opts.widget.template,
      resourceManager,
      opts.globals
    );

    // Check for display_duration or duration option and set timeline duration
    // This prevents animations from looping when a fixed duration is specified
    const durationOption =
      opts.config.options?.display_duration ?? opts.config.options?.duration;
    if (typeof durationOption === 'number' && durationOption > 0) {
      this.displayDuration = durationOption * 1000; // Convert seconds to ms
      this.timeline.setDuration(this.displayDuration);
    }
  }

  /**
   *
   * Loads all the required assets by the template, such as
   * fonts, images, etc.
   *
   * @returns
   */
  private load() {
    return forkJoin([this.loadFonts(), this.loadMedias()]);
  }

  private loadFonts() {
    if (!this.opts.fonts || this.opts.fonts.length === 0) {
      return of('no:fonts');
    }

    return from(this.opts.fonts).pipe(
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
      (document.fonts as any).add(loadedFace);
      return loadedFace;
    });
  }

  private loadMedias() {
    if (!this.opts.medias || this.opts.medias.length === 0) {
      return of('no:medias');
    }
    return from(this.opts.medias).pipe(
      mergeMap((url) =>
        from(this.resourceManager.getMedia(url)).pipe(
          map((cachedUrl) => {
            this.medias[url] = cachedUrl || url;
            return of('media:cached');
          })
        )
      )
    );
  }

  async unload() {
    // Note: there is a risk here that we remove a font that is still in use by another widget.
    // We would need to either keep track of the fonts in use or add a unique prefix to the font name.
    // Probably a global font cache would be the best solution.
    const fontFaceSet = document.fonts;
    const fontFacesNames = Object.keys(this.fontFaces);

    for (let i = 0; i < fontFacesNames.length; i++) {
      const fontFaceName = fontFacesNames[i];
      if (fontFaceName) {
        const fontFace = await this.fontFaces[fontFaceName];
        if (fontFace) {
          (fontFaceSet as any).delete(fontFace);
        }
        delete this.fontFaces[fontFaceName];
      }
    }
  }

  show(el: HTMLElement, offset: number) {
    // Note: we need to think how data is refreshed when the model changes.
    const basetime = Date.now();

    return this.load().pipe(
      switchMap((x) => {
        if (el.children.length === 0) {
          // Create observable that will emit when the template is ready.
          return new Observable<string>((subscriber) => {
            render(
              () =>
                Template({
                  name: this.opts.widget.name,
                  root: this.template,
                  config: this.opts.config,
                  style: this.opts?.style,
                  timeline: this.timeline,
                  globals: this.opts.globals,
                  resourceManager: this.resourceManager,
                  onReady: () => {
                    this.seek(offset + (Date.now() - basetime));
                    subscriber.next('template-widget:shown');
                    subscriber.complete();
                  },
                }),
              el
            );
          });
        }

        // Seek to compensate for the time spent loading the assets.
        this.seek(offset + (Date.now() - basetime));
        return of('template-widget:shown');
      })
    );
  }

  mimeType(): string {
    return 'template/widget';
  }

  duration(): number {
    // If displayDuration was explicitly set from options, use that
    if (this.displayDuration && this.displayDuration > 0) {
      return this.displayDuration;
    }

    // Prefer the dynamic timeline duration if it's available (non-zero).
    // This is important for components like video that add their own timeline items
    // with actual durations after loading (e.g., actual video length).
    const timelineDuration = this.timeline.duration();

    // Fall back to the static resolveDuration for components that don't
    // dynamically add timeline items (e.g., static images, text).
    // Note: resolveDuration may return 0 or NaN if bindings aren't resolved yet,
    // so we default to 10000ms (10 seconds) in that case.
    const resolved = this.template.resolveDuration(this.medias);

    if (timelineDuration > 0) {
      return timelineDuration;
    }

    return resolved > 0 ? resolved : 10000;
  }
}
