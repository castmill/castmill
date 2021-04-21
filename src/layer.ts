/*
  A Layer embedds a Widget that is always inside a iframe.
  <iframe src='https://castmill.com/widgets/1234567890abcdef'></iframe>

  (c) 2011-2021 Optimal Bits Sweden AB All Rights Reserved
*/
import { Status } from "./playable";
import { Config } from "./config";
import * as utils from "./iframe";
import { EventEmitter } from "eventemitter3";
import { Widget } from "./widgets";
import { of, Observable, merge, timer, race } from "rxjs";
import { catchError, last, map, takeUntil } from "rxjs/operators";

const TIMER_RESOLUTION = 50;

export class Layer extends EventEmitter {
  // implements Playable {
  id: string = "";
  widgetId: string = "";

  opacity: string = "1";

  rotation: number = 0;
  zIndex: number = 0;

  el: HTMLElement;

  status: Status = Status.NotReady;
  offset = 0;

  private widget?: Widget;
  private config!: Config;
  private proxyOffset: (position: number) => void;
  private _duration = 0;

  constructor(
    public name: string,
    opts?: { duration?: number; widget?: Widget }
  ) {
    super();

    this._duration = opts?.duration || 0;
    this.widget = opts?.widget;

    // Shoulnd't we also move this el creation to load? so that it can bbe freed with unload? I think so...
    this.el = document.createElement("div");

    const { style, dataset } = this.el;
    style.position = "absolute";
    style.width = "100%";
    style.height = "100%";
    style.display = "flex";
    style.justifyContent = "center";
    style.alignItems = "center";

    dataset["layer"] = this.name;

    this.proxyOffset = (offset: number) => this.emit("offset", offset);
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
      throw new Error("Layer: missing widget");
    }

    console.log(`Start playing layer: ${this.name}`);
    const end$ = timer$.pipe(
      last(),
      // In case the stream is empty we need to catch and end.
      catchError(() => of(undefined)),
      map(() => "end")
    );

    return this.widget.play(timer$).pipe(takeUntil(end$));
  }

  public async stop(): Promise<any> {
    return this.widget?.stop();
  }

  public seek(offset: number) {
    this.offset = offset;
    return this.widget?.seek(offset);
  }

  show(offset: number) {
    if (this.widget) {
      return this.widget.show(this.el, offset);
    } else {
      return of("shown");
    }
  }

  async hide(): Promise<void> {
    return;
  }

  duration() {
    return this._duration || this.widget?.duration() || 0;
  }

  private getWidgetSrc(): string {
    return this.config.widgetBase + "/" + this.widgetId;
  }
}
