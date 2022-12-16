import { ResourceManager } from "@castmill/cache";
import { EventEmitter } from "eventemitter3";
import { NEVER, Observable, of } from "rxjs";

interface ProxyMethodData {
  counter: number;
  method: string;
  args: any[];
}

export abstract class Widget extends EventEmitter {
  protected messageHandler?: (ev: MessageEvent) => void;

  constructor(protected resourceManager: ResourceManager, opts?: {}) {
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
   * Prepare widget. This method should do all async and heavy stuff necessary so
   * that the widget can start playing directly without delay after it.
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
