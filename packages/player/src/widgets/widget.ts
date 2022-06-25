import { EventEmitter } from "eventemitter3";
import { NEVER, Observable, of } from "rxjs";
import { JsonWidget } from "../";
import { JsonLayout } from "../interfaces";
import { Image, Video, TextWidget, Layout } from "./";

interface ProxyMethodData {
  counter: number;
  method: string;
  args: any[];
}

export abstract class Widget extends EventEmitter {
  protected messageHandler?: (ev: MessageEvent) => void;

  static async fromJSON(json: JsonWidget): Promise<Widget | undefined> {
    // TODOO: If it is an external widget we must load it dynamically, using a Proxy so that
    // the widget is isolated inside an iframe.
    // const widget = await Proxy.fromJSON(json);
    // const widget = await import(`./${json.uri}`);

    switch (json.uri) {
      case "widget://image":
        return new Image(
          json.args as { src: string; size: "contain" | "cover" }
        );
      case "widget://video":
        return new Video(json.args as { src: string; volume: number });
      case "widget://text":
        return new TextWidget(
          json.args as {
            text: string;
            css: Partial<CSSStyleDeclaration>;
            font?: { url: string; name: string };
            animation?: {
              from: gsap.TweenVars;
              perspective?: number;
              chars?: boolean;
            };
          }
        );
      /*
      case "widget://text-scroll":
        return new TextScroll(json.args as { text: Text[]; speed: number });
        */
      case "widget://layout":
        return Layout.fromLayoutJSON(json.args as JsonLayout);
    }
  }

  constructor(opts?: {}) {
    super();

    if (window.parent) {
      const messageHandler = (this.messageHandler = (ev: MessageEvent) => {
        let data: ProxyMethodData;

        try {
          data = JSON.parse(ev.data);
        } catch (err) {
          // Ignore corrupt messages.
          return;
        }

        let result;
        switch (data.method) {
          case "unload":
            this.unload();
            break;
          case "play":
            // We need to create an observable based on the notification observable
            // filtering for the timer event.
            // result = this.play.apply(this, data.args);
            break;
          case "show":
          // How to deal with el and offset here?
        }

        window.parent.postMessage(
          JSON.stringify({
            counter: data.counter,
            result,
          })
        );
      });

      window.addEventListener("message", messageHandler, false);
    }
  }

  /**
   * Prepare widget. This method should do all async stuff necessary so
   * that the widget can start playing directly after it.
   */
  // abstract load(el: HTMLElement): Observable<string>;

  /**
   * Unload.
   * Load the widget removing all resources.
   */
  unload() {}

  /**
   * Return mimetype for this widget
   */
  mimeType() {}

  /**
   *  Starts playing the content.
   */
  play(timer$: Observable<number>): Observable<string | number> {
    return NEVER;
  }

  stop() {}

  show(el: HTMLElement, offset: number): Observable<string> {
    return of("shown");
  }

  seek(offset: number): Observable<[number, number]> {
    return of([offset, 0]);
  }

  duration(): Observable<number> {
    return of(0);
  }

  toggleDebug() {}

  volume(level: number) {}
}
