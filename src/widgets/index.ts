import { EventEmitter } from "eventemitter3";
import { NEVER, Observable, of } from "rxjs";

export abstract class Widget extends EventEmitter {
  constructor(opts?: {}) {
    super();
  }

  /**
   * Prepare widget. This method should do all async stuff necessary so
   * that the widget can start playing directly after it.
   */
  // abstract load(el: HTMLElement): Observable<string>;

  /**
   * Dispose.
   * Disposes the widget removing all resources.
   */
  abstract unload(): void;

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

  seek(offset: number) {}

  duration() {
    return 0;
  }

  volume(level: number) {}
}
