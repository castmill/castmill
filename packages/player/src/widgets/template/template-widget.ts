import { JSX } from 'solid-js';

import { ResourceManager } from '@castmill/cache';
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  forkJoin,
  from,
  merge,
  of,
} from 'rxjs';
import { mergeMap, map, switchMap, take } from 'rxjs/operators';
import { TimelineWidget } from '../timeline-widget';

import { render } from 'solid-js/web';
import { Template, TemplateComponent } from './template';
import { TemplateConfig } from './binding';
import { JsonWidget } from '../../interfaces';
import { JsonWidgetConfig } from '../../interfaces/json-widget-config.interface';
import {
  PlayerGlobals,
  PlayerRuntimeError,
} from '../../interfaces/player-globals.interface';

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
  // Emits once the rendered template is ready, e.g. its videos have loaded.
  private ready$?: ReplaySubject<void>;
  // Globals for the rendered components; blocked videos report to this
  // widget. Nested template widgets override the hook again, so a block
  // reaches the nearest playlist item.
  private globals: PlayerGlobals;
  private blocks = new Map<object, PlayerRuntimeError>();
  private blocked = new BehaviorSubject<PlayerRuntimeError | undefined>(
    undefined
  );
  private blockedSince?: number;
  private blockedTotal = 0;

  constructor(
    resourceManager: ResourceManager,
    private opts: TemplateWidgetOptions
  ) {
    super(resourceManager, opts);

    this.globals = Object.assign({}, opts.globals, {
      setPlaybackBlocked: (source: object, block?: PlayerRuntimeError) =>
        this.setBlocked(source, block),
    });

    this.template = TemplateComponent.fromJSON(
      opts.widget.template,
      resourceManager,
      this.globals,
      opts.config
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

  blocked$(): Observable<PlayerRuntimeError | undefined> {
    return this.blocked;
  }

  private setBlocked(source: object, block?: PlayerRuntimeError): void {
    if (block) {
      this.blocks.set(source, block);
    } else {
      this.blocks.delete(source);
    }
    let current: PlayerRuntimeError | undefined;
    this.blocks.forEach((value) => {
      current = current || value;
    });
    if (current && this.blockedSince === undefined) {
      this.blockedSince = Date.now();
    } else if (!current && this.blockedSince !== undefined) {
      this.blockedTotal += Date.now() - this.blockedSince;
      this.blockedSince = undefined;
    }
    if (current !== this.blocked.getValue()) this.blocked.next(current);
  }

  // Total time any rendered component has been blocked.
  private blockedTime(): number {
    return (
      this.blockedTotal +
      (this.blockedSince === undefined ? 0 : Date.now() - this.blockedSince)
    );
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
    const blockedAtBase = this.blockedTime();

    return this.load().pipe(
      switchMap(() => {
        if (el.children.length === 0 || !this.ready$) {
          const ready$ = new ReplaySubject<void>(1);
          this.ready$ = ready$;
          render(
            () =>
              Template({
                name: this.opts.widget.name,
                root: this.template,
                config: this.opts.config,
                style: this.opts?.style,
                timeline: this.timeline,
                globals: this.globals,
                resourceManager: this.resourceManager,
                onReady: () => ready$.next(),
              }),
            el
          );
        }

        // A show that arrives while the template is still getting ready (for
        // example a seek of a layout area while its first video loads) must
        // wait as well. Otherwise playback starts with default durations,
        // such as 10s for a video whose metadata hasn't loaded yet.
        return this.ready$.pipe(
          take(1),
          map(() => {
            // Seek to compensate for the time spent loading the assets. Time
            // spent waiting for a decoder is excluded: playlists hold their
            // clock while an item is blocked.
            const blocked = this.blockedTime() - blockedAtBase;
            this.seek(offset + Math.max(0, Date.now() - basetime - blocked));
            return 'template-widget:shown';
          })
        );
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
