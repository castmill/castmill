/*
  A Layer embedds a Widget that is always inside a iframe.
  <iframe src='https://castmill.com/widgets/1234567890abcdef'></iframe>

  (c) 2011-2016 Optimal Bits Sweden AB All Rights Reserved
*/

import { Widget } from "./widget";
import { Playable } from "./playable";
import { Config } from "./config";
import { extend } from "lodash";
import * as utils from "./iframe";

export class Layer implements Playable {
  id: string = "";
  widgetId: string = "";

  opacity: string = "1";
  rotation: number = 0;
  zIndex: number = 0;

  el: HTMLElement;

  private widget!: Widget;
  private iframe!: HTMLIFrameElement;
  private config!: Config;
  private _duration: number = 0;


  constructor(opts?: {}) {
    extend(this, opts);
    this.el = document.createElement("div");
    // TODO: Add css needed for this layer.
    $(this.el).css({
      position: "absolute",
      width: "100%",
      height: "100%"
    });
  }

  async load() {
    this.iframe = await utils.createIframe(this.el, this.getWidgetSrc());
    this.widget = await utils.getIframeWidget(this.iframe);
    return this.widget.ready();
  }

  public unload(): Promise<void> {
    utils.purgeIframe(this.iframe);
    return Promise.resolve(void 0);
  }

  public toJSON(): {} {
    return {
      id: this.id,
      widgetId: this.widgetId
    };
  }

  public duration(): number {
    return this._duration || this.widget.duration();
  }

  public play(): Promise<any> {
    return Promise.all([this.widget.play(), delay(this.duration())]);
  }

  public stop(): Promise<any> {
    return this.widget.stop();
  }

  public seek(offset: number): Promise<any> {
    return this.widget.seek(offset);
  }

  async show(): Promise<void> {
    return;
  }

  async hide(): Promise<void> {
    return;
  }

  private getWidgetSrc(): string {
    return this.config.widgetBase + "/" + this.widgetId;
  }
}

function delay (duration: number) {
	return function(){
		return new Promise(function(resolve, reject){
			setTimeout(function(){
				resolve();
			}, duration)
		});
	};
};
