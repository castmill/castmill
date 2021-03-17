import { Widget } from "../widgets";

/**
 * Widget Proxy
 * This class acts as a proxy for the widgets, since widgets are instantiated
 * inside an iframe they need this class in order to be accessible.
 *
 */

export class Proxy extends Widget {
  private messageHandler: (event: any) => void;
  private origin!: string;
  private counter: number = 0;
  private resolvers: {
    [index: number]: (value: any) => void;
  } = {};

  constructor(
    private parent: Window,
    private iframe: HTMLIFrameElement,
    childSrc: string
  ) {
    super();

    const messageHandler = (this.messageHandler = (event) => {
      let data;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        // Ignore corrupt messages.
        return;
      }

      if (typeof data.counter !== "undefined") {
        if (this.resolvers[data.counter]) {
          this.resolvers[data.counter](data.result);
          delete this.resolvers[data.counter];
        }
      } else if (typeof data.offset !== "undefined") {
        this.emit("offset", data.offset);
      }
    });

    this.origin = childSrc;

    this.parent.addEventListener("message", messageHandler, false);
  }

  async load() {
    return this.callMethod("prepare");
  }

  /**
   * Widget is ready.
   */
  async ready(): Promise<void> {}

  /**
   * Dispose.
   */
  unload(): void {
    this.parent.removeEventListener("message", this.messageHandler);
  }

  /**
   * Return mimetype for this widget
   */
  mimeType(): string {
    return "proxy";
  }

  /**
   *  Starts playing the content.
   *  It returns a promise that resolves when the content has played completely.
   */
  async play() {
    return this.callMethod("play");
  }

  async stop() {
    return this.callMethod("stop");
  }

  async duration(): Promise<number> {
    return this.callMethod("duration");
  }

  async seek(offset: number) {
    return this.callMethod("seek", [offset]);
  }

  async volume(level: number) {
    return this.callMethod("volume", [level]);
  }

  private async callMethod(method: string, args?: any[]): Promise<any> {
    const counter = this.counter++;
    const message = {
      counter: counter,
      method: method,
      args: args,
    };

    this.iframe.contentWindow?.postMessage(
      JSON.stringify(message),
      this.origin
    );

    return new Promise((resolve) => {
      this.resolvers[counter] = resolve;
    });
  }
}
