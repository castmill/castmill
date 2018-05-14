import { EventEmitter } from 'eventemitter3';


export abstract class Widget extends EventEmitter {
  constructor(el?: HTMLElement, opts?: {}) {
    super();
  }

  /**
   * Widget is ready.
   */
  abstract ready(): Promise<void>;

  /**
   * Dispose.
   */
  abstract dispose(): void;

  /**
   * Return mimetype for this widget
   */
  abstract mimeType(): string;

  /**
   *  Starts playing the content.
   *  It returns a promise that resolves when the content has played completely.
   */
  async play() {}

  async stop() {}

  async seek(offset: number) {}

  async duration(): Promise<number> {
    return 0;
  }

  async volume(level: number) {}
}
