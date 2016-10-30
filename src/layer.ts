/*
  A Layer embedds a Widget that is always inside a iframe.
  <iframe src='https://castmill.com/widgets/1234567890abcdef'></iframe>

  (c) 2011-2016 Optimal Bits Sweden AB All Rights Reserved
*/

/// <reference path="../node_modules/@types/es6-promise/index.d.ts" />
/// <reference path="../node_modules/@types/bluebird/index.d.ts" />
/// <reference path="../node_modules/@types/lodash/index.d.ts" />

/// <reference path="config.ts" />
/// <reference path="playable.ts" />
/// <reference path="widget.ts" />
/// <reference path="iframe.ts" />

namespace Castmill {

  export class Layer implements Playable{
    id: string;
    widgetId: string;

    opacity: string;
    rotation: number;
    zIndex: number;

    el: HTMLElement;

    private widget: Widget;
    private iframe: HTMLIFrameElement;
    private config: Config;
    private _duration: number = 30000;

    private loading: Promise<any>;

    constructor(opts: {}) {
      _.extend(this, opts);
      this.el =  document.createElement('div');
      // TODO: Add css needed for this layer.
      $(this.el).css({
        position: 'absolute',
        width: '100%',
        height: '100%'
      });
    }

    public load(): Promise<void>{
      return this.loading = Castmill.createIframe(this.el, this.getWidgetSrc()).then((iframe) => {
        this.iframe = iframe;
        return Castmill.getIframeWidget(iframe);
      }).then((widget) => {
        this.widget = widget;
        return widget.ready();
      });
    }

    public unload(): Promise<void> {
      Castmill.purgeIframe(this.iframe);
      return Promise.resolve(void 0);
    }

    public toJSON(): {} {
      return {
        id: this.id,
        widgetId: this.widgetId
      };
    }

    public duration(): number {
      return this._duration;
    }

    public play(): Promise<void>{
      return this.widget.play().then(() => {
        return Bluebird.delay(this._duration)
      })
    }

    public stop(): Promise<void>{
      return this.widget.stop();
    }

    public seek(offset: number): Promise<void>{
      return this.widget.seek(offset);
    }

    public show(): Promise<void> {
      return;
    }

    public hide(): Promise<void> {
      return;
    };

    private getWidgetSrc(): string {
      return this.config.widgetBase + '/' + this.widgetId;
    }

  }

}