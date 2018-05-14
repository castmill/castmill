/*
  A Layer embedds a Widget that is always inside a iframe.
  <iframe src='https://castmill.com/widgets/1234567890abcdef'></iframe>

  (c) 2011-2016 Optimal Bits Sweden AB All Rights Reserved
*/

import { Proxy } from "./widgets/proxy";
import { Playable, Status } from "./playable";
import { Config } from "./config";
import { extend } from "lodash";
import * as utils from "./iframe";
import { EventEmitter } from "eventemitter3";

export class Layer extends EventEmitter implements Playable {
  id: string = "";
  widgetId: string = "";

  opacity: string = "1";



  rotation: number = 0;
  zIndex: number = 0;

  el: HTMLElement;

  status: Status = Status.NotReady;

  private widget!: Proxy;
  private iframe!: HTMLIFrameElement;
  private config!: Config;
  private _duration: number = 0;
  private proxyOffset: (position: number) => void;

  constructor(opts?: {}) {
    super();
    extend(this, opts);
    this.el = document.createElement("div");
    // TODO: Add css needed for this layer.
    $(this.el).css({
      position: "absolute",
      width: "100%",
      height: "100%"
    });

    this.proxyOffset = (offset: number) => this.emit("offset", offset);
  }

  async load() {
    const widgetSrc = this.getWidgetSrc();
    this.iframe = await utils.createIframe(this.el, widgetSrc);
    this.widget = new Proxy(
      window,
      <Window>this.iframe.contentWindow,
      widgetSrc
    );
    this.widget.on("offset", this.proxyOffset);
    return this.widget.ready();
  }

  public async unload() {
    utils.purgeIframe(this.iframe);
    this.widget && this.widget.off("offset", this.proxyOffset);
  }

  public toJSON(): {} {
    return {
      id: this.id,
      widgetId: this.widgetId
    };
  }

  public async duration(): Promise<number> {
    return (
      this._duration || (this.widget && (await this.widget.duration())) || 0
    );
  }

  public async play(): Promise<any> {
    return Promise.all([this.widget.play(), delay(await this.duration())]);
  }

  public async stop(): Promise<any> {
    return this.widget.stop();
  }

  public async seek(offset: number): Promise<any> {
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

function delay(duration: number) {
  return function() {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        resolve();
      }, duration);
    });
  };
}
