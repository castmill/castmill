import { Widget } from "../widgets";

export class Proxy extends Widget {
  private messageHandler: (event: any) => void;
  private origin!: string;
  private counter: number = 0;
  private resolvers: {
    [index: number]: (value: any) => void;
  } = {};

  constructor(private parent: Window, private child: Window, childSrc: string) {
    super();

    const messageHandler = (this.messageHandler = event => {
      const data = JSON.parse(event.data);

      if(typeof data.counter !== 'undefined'){
        if (this.resolvers[data.counter]) {
          this.resolvers[data.counter](data.result);
          delete this.resolvers[data.counter];
        }
      }else if(typeof data.offset !== 'undefined'){
        this.emit('offset', data.offset);
      }
    });

    this.origin = childSrc;

    this.parent.addEventListener("message", messageHandler, false);
  }

  /**
   * Widget is ready.
   */
  async ready(): Promise<void> {}

  /**
   * Dispose.
   */
  dispose(): void {
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
      args: args
    };

    this.child.postMessage(JSON.stringify(message), this.origin);

    return new Promise(resolve => {
      this.resolvers[counter] = resolve;
    });
  }
}
