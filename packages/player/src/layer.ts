/*
  Layer is the item that can be added to a playlist.

  (Rename to WidgetContainer?)

  (c) 2011-2023 Castmill AB All Rights Reserved
*/
import { JSX } from 'solid-js';
import { ResourceManager } from '@castmill/cache';

import { Status } from './playable';
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
import { applyCss } from './utils';
import { PlayerGlobals } from './interfaces/player-globals.interface';

export class Layer extends EventEmitter {
  id: string = '';
  widgetId: string = '';

  opacity: string = '1';

  rotation: number = 0;
  zIndex: number = 0;

  el: HTMLElement;

  status: Status = Status.NotReady;
  offset = 0;

  transition?: Transition;

  slack: number = 0;

  private widget?: Widget;
  private proxyOffset: (position: number) => void;
  private _duration = 0;

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
    const widget = new TemplateWidget(resourceManager, {
      widget: json.widget,
      config: json.config,
      style: json.style,
      globals,
    });

    const layer = new Layer(json.name, {
      duration: json.duration,
      slack: json.slack,
      transition: json.transition && fromJSON(json.transition),
      style: json.style || {
        width: '100%',
        height: '100%',
      },
      widget,
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
        id: 'layout-1-1',
        widget_id: 666,
        options: {},
        data: {},
      },
      globals,
    } as TemplateWidgetOptions);
    const duration = widget.duration();
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
    }
  ) {
    super();

    this._duration = opts?.duration || 0;
    this.slack = opts?.slack || 0;
    this.widget = opts?.widget;
    this.transition = opts?.transition;

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

    this.proxyOffset = (offset: number) => this.emit('offset', offset);
  }

  toggleDebug() {
    this.widget?.toggleDebug();
  }

  /*
  load() {
    // const widgetSrc = this.getWidgetSrc();
    // this.iframe = await utils.createIframe(this.el, widgetSrc);
    // this.widget = new Proxy(window, this.iframe, widgetSrc);
    // this.widget.on("offset", this.proxyOffset);

    if (this.widget) {
      return this.widget.load(this.el);
    } else {
      return of<string>("loaded");
    }
  }
  */

  public unload() {
    /*
    utils.purgeIframe(this.iframe);
    this.widget && this.widget.off("offset", this.proxyOffset);
    */
    this.widget?.seek(0);
    return this.widget?.unload();
  }

  public toJSON(): {} {
    return {
      id: this.id,
      widgetId: this.widgetId,
    };
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
