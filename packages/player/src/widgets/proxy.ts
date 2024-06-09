import { ResourceManager } from '@castmill/cache';
import { Observable, from, of } from 'rxjs';
import { JsonWidget } from '../interfaces';

import { Widget } from './';

interface ProxyData {
  counter: number;
  result: any;
}

interface ProxyRequest {
  type: 'request';
  id: number;
  method: string;
  args: any[];
}

interface ProxyResponse {
  type: 'response';
  id: number;
  result: any;
}

interface ProxyNotification {
  type: 'notification';
  data: any;
}

/**
 * We should create a observable that emits all the messages received from the iframe.
 */

/**
 * WIP: Widget Proxy
 * This class WILL act as a proxy for the widgets, since widgets are instantiated
 * inside an iframe they need this class in order to be accessible from the parent
 * window.
 * Ideas: https://github.com/mdn/dom-examples/blob/master/channel-messaging-basic/page2.html
 */

export class Proxy extends Widget {
  private static id = 0;
  protected messageHandler?: (ev: MessageEvent<string>) => void;
  private origin!: string;
  private resolvers: {
    [index: number]: (value: any) => void;
  } = {};

  static async fromJSON(json: JsonWidget): Promise<Widget | undefined> {
    // uri example: https://widgets.castmill.io/tpd/
    // TODO: uri may need credentials
    // Probably better to use "fetch" instead of import here, since
    // we would like to get the src code and embedd it in a iframe as
    // srcdoc string.
    // templates may be loaded separatedly as part of the widget
    // initialization process and the selected options.
    // const widgetSrc = await import(`./${json.uri}`);
    return void 0;
  }

  constructor(
    private parent: Window,
    private iframe: HTMLIFrameElement,
    resourceManager: ResourceManager,
    childSrc: string
  ) {
    super(resourceManager);

    const messageHandler = (this.messageHandler = (event) => {
      let data: ProxyData;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        // Ignore corrupt messages.
        return;
      }

      if (typeof data.counter !== 'undefined') {
        if (this.resolvers[data.counter]) {
          this.resolvers[data.counter](data.result);
          delete this.resolvers[data.counter];
        }
      }
      /*
      else if (typeof data.offset !== "undefined") {
        this.emit("offset", data.offset);
      }
      */
    });

    this.origin = childSrc;

    this.parent.addEventListener('message', messageHandler, false);
  }

  async load() {
    return this.callMethod('prepare');
  }

  /**
   * Widget is ready.
   */
  async ready(): Promise<void> {}

  /**
   * Dispose.
   */
  unload(): void {
    if (this.messageHandler) {
      this.parent.removeEventListener('message', this.messageHandler);
    }
  }

  /**
   * Return mimetype for this widget
   */
  mimeType(): string {
    return 'proxy';
  }

  /**
   *  Starts playing the content.
   */
  play(timer$: Observable<any>): Observable<string | number> {
    return from(this.callMethod('play'));
  }

  stop() {
    return this.callMethod('stop');
  }

  /*
  duration(): Observable<number> {
    return this.callMethod("duration");
  }
  */

  seek(offset: number) {
    return this.callMethod('seek', [offset]);
  }

  volume(level: number) {
    return this.callMethod('volume', [level]);
  }

  private callMethod(method: string, args?: any[]): Observable<any> {
    const counter = Proxy.id++;
    const message = {
      counter,
      method,
      args,
    };

    this.iframe.contentWindow?.postMessage(
      JSON.stringify(message),
      this.origin
    );

    return of(this.resolvers[counter]);
    /*
    return new Promise((resolve) => {
      this.resolvers[counter] = resolve;
    });
    */
  }
}
