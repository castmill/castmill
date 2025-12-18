/*
  Layer is the item that can be added to a playlist.

  (c) 2011-2025 Castmill AB All Rights Reserved
*/
import { JSX } from 'solid-js';
import { ResourceManager } from '@castmill/cache';

import { EventEmitter } from 'eventemitter3';
import {
  TemplateComponentType,
  TemplateWidget,
  TemplateWidgetOptions,
  Widget,
} from './widgets';
import { of, Observable } from 'rxjs';
import { catchError, last, map, takeUntil } from 'rxjs/operators';
import { JsonLayer, JsonPlaylist } from './interfaces';
import { Transition, fromJSON } from './transitions';
import { applyCss, parseAspectRatio } from './utils';
import { PlayerGlobals } from './interfaces/player-globals.interface';

/**
 * Computes style for a widget based on its aspect ratio.
 * Returns a base style - the dynamic min-width/min-height adjustment
 * is handled by the Layer's ResizeObserver.
 */
function computeWidgetStyle(
  baseStyle: JSX.CSSProperties | undefined,
  aspectRatio: string | undefined
): JSX.CSSProperties {
  const defaultStyle: JSX.CSSProperties = {
    width: '100%',
    height: '100%',
  };

  const ratio = parseAspectRatio(aspectRatio);
  if (ratio === null) {
    return baseStyle || defaultStyle;
  }

  // Base style for aspect-ratio widget
  // The dynamic min-width OR min-height is set by ResizeObserver in Layer
  return {
    ...baseStyle,
    width: 'auto',
    height: 'auto',
    'max-width': '100%',
    'max-height': '100%',
    'aspect-ratio': `${ratio}`,
  };
}

export class Layer extends EventEmitter {
  el: HTMLElement;
  offset = 0;
  transition?: Transition;
  slack: number = 0;

  private widget?: Widget;
  private _duration = 0;
  private widgetAspectRatio: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  /**
   * Creates a new Layer from a json deserialized object.
   *
   * @param json
   */
  static fromJSON(
    json: JsonLayer,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): Layer {
    // Compute widget style based on its aspect ratio
    const widgetStyle = computeWidgetStyle(
      json.style,
      json.widget.aspect_ratio
    );

    const widget = new TemplateWidget(resourceManager, {
      widget: json.widget,
      config: json.config,
      style: widgetStyle,
      globals,
    });

    const layer = new Layer(json.name, {
      duration: json.duration,
      slack: json.slack,
      transition: json.transition && fromJSON(json.transition),
      style: widgetStyle,
      widget,
      widgetAspectRatio: json.widget.aspect_ratio,
    });

    return layer;
  }

  /**
   *
   * Creates a new Layer from a playlist. Useful if you want to easily add a playlist
   * as an item in another playlist.
   *
   * @param playlist The playlist to create a layer from as a JsonPlaylist
   * @param resourceManager The resource manager to use for loading the widget's assets.
   *
   * @param opts
   */
  static fromPlaylist(
    playlist: JsonPlaylist,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): Layer {
    const widget: TemplateWidget = new TemplateWidget(resourceManager, {
      name: 'layout',
      duration: 10000, // Currently a hack, the duration should be the duration of the playlist
      widget: {
        id: 666,
        name: 'layout-1-1',
        description: 'Main playlist layout',
        template: {
          name: 'Main playlist layout',
          type: TemplateComponentType.Layout,
          opts: {
            containers: [
              {
                playlist,
                style: {
                  width: '100%',
                  height: '100%',
                  left: '0%',
                  top: '0%',
                  overflow: 'auto',
                },
              },
            ],
          },
        },
      },
      fonts: [],
      style: {
        width: '100%',
        height: '100%',
      },
      config: {
        id: 'layout-config-1',
        widget_id: 666,
        options: {},
        data: {},
      },
      globals,
    } as TemplateWidgetOptions);

    return new Layer(playlist.name, {
      widget,
      duration: 10000, // Currently a hack, the duration should be the duration of the playlist
    });
  }

  constructor(
    public name: string,
    opts?: {
      duration?: number;
      slack?: number; // Some extra slack over the widget duration.
      widget?: Widget;
      transition?: Transition;
      style?: JSX.CSSProperties;
      widgetAspectRatio?: string;
    }
  ) {
    super();

    this._duration = opts?.duration || 0;
    this.slack = opts?.slack || 0;
    this.widget = opts?.widget;
    this.transition = opts?.transition;
    this.widgetAspectRatio = parseAspectRatio(opts?.widgetAspectRatio);

    this.el = document.createElement('div');

    const { style, dataset } = this.el;

    if (opts?.style) {
      applyCss(this.el, opts.style);
    }

    style.position = 'absolute';
    style.width = '100%';
    style.height = '100%';
    style.display = 'flex';
    style.justifyContent = 'center';
    style.alignItems = 'center';

    dataset['layer'] = this.name;

    // Set up ResizeObserver for dynamic aspect ratio adjustment
    if (this.widgetAspectRatio !== null) {
      this.setupResizeObserver();
    }
  }

  /**
   * Sets up a ResizeObserver to dynamically adjust widget sizing based on container dimensions.
   * When the container's aspect ratio differs from the widget's, we need to set either
   * min-width: 100% (for portrait containers) or min-height: 100% (for landscape containers).
   */
  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        const containerRatio = width / height;
        const widgetRatio = this.widgetAspectRatio!;

        // Find the widget element (first child of the layer)
        const widgetEl = this.el.firstElementChild as HTMLElement;
        if (!widgetEl) continue;

        // If container is wider than widget ratio (landscape container, landscape widget)
        // or container is portrait and widget is landscape, we need different strategies
        if (containerRatio >= widgetRatio) {
          // Container is wider/same ratio - height is the constraint
          // Set min-height: 100% to fill vertically, width will scale proportionally
          widgetEl.style.minHeight = '100%';
          widgetEl.style.minWidth = '';
        } else {
          // Container is taller/narrower - width is the constraint
          // Set min-width: 100% to fill horizontally, height will scale proportionally
          widgetEl.style.minWidth = '100%';
          widgetEl.style.minHeight = '';
        }
      }
    });

    this.resizeObserver.observe(this.el);
  }

  toggleDebug() {
    this.widget?.toggleDebug();
  }

  public unload() {
    // Cleanup ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.widget?.seek(0);
    return this.widget?.unload();
  }

  public play(timer$: Observable<number>): Observable<string | number> {
    if (!this.widget) {
      throw new Error('Layer: missing widget');
    }

    const end$ = timer$.pipe(
      last(),
      // In case the stream is empty we need to catch and end.
      catchError(() => of(undefined)),
      map(() => 'end')
    );

    return this.widget.play(timer$).pipe(takeUntil(end$));
  }

  public async stop(): Promise<any> {
    return this.widget?.stop();
  }

  public seek(offset: number): Observable<[number, number]> {
    this.offset = offset;
    if (this.widget) {
      return this.widget.seek(offset);
    }
    return of([offset, 0]);
  }

  show(offset: number) {
    if (this.widget) {
      return this.widget.show(this.el, offset).pipe(
        catchError((err) => {
          // TODO: we should show more information about this error. Which widget? and which options?
          // for instance a common failure is a video or image that failed to be downloaded.
          console.error(`Layer: show widget error`, err);
          return of('error');
        })
      );
    } else {
      return of('shown');
    }
  }

  async hide(): Promise<void> {
    return;
  }

  duration(): number {
    const transitionDuration = this.transition?.duration || 0;
    if (this._duration) {
      return this._duration + transitionDuration;
    } else if (this.widget) {
      return this.widget.duration() + this.slack + transitionDuration;
    } else {
      return this.slack;
    }
  }
}
