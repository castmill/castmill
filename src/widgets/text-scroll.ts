import { Observable, of } from "rxjs";
import { Widget } from "./index";
import { Text, Scroll } from "./scroll/scroll";

export class TextScroll extends Widget {
  private canvas: HTMLCanvasElement | null = null;
  private scroll: Scroll | null = null;
  private text: Text[];
  private speed: number;

  offset: number = 0;

  constructor(opts: { text: Text[]; speed: number }) {
    super();
    this.text = opts.text;
    this.speed = opts.speed;
  }

  show(el: HTMLElement, offset: number) {
    if (!this.scroll) {
      this.scroll = new Scroll(el, this.text);
    }
    return of("shown");
  }

  play(timer$: Observable<number>) {
    if (this.scroll) {
      return this.scroll.play(this.speed);
    }
    return super.play(timer$);
  }

  // TODO: Implement "duration" if possible, i.e., the time it will take to show all the text before it loops again.

  /*
  // TODO: seek is a bit complicated and may not be possible to be implemented for this widget.
  seek(offset: number) {
    if (this.scroll) {
      const t = offset * this.speed * 60; // we assume 60fps
      this.scroll.updateScroll(t, true);
    }
  }
  */

  unload() {
    if (this.canvas) {
      document.removeChild(this.canvas);
    }
  }
}
