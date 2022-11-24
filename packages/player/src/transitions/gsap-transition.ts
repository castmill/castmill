import { Observable } from "rxjs";
import { gsap } from "gsap";

import { Transition } from "./transition";
import { Layer } from "../layer";

export class GsapTransition extends Transition {
  protected timeline: gsap.core.Timeline | null = null;

  private src: Layer | null = null;
  private dst: Layer | null = null;

  private srcStyle: string | null = null;
  private dstStyle: string | null = null;

  constructor(opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  init(src: Layer, dst: Layer) {
    this.src = src;
    this.dst = dst;

    // Store original styles
    this.srcStyle = src.el.getAttribute("style");
    this.dstStyle = dst.el.getAttribute("style");

    if (this.timeline) {
      this.timeline.kill();
    }

    this.timeline = gsap.timeline({ paused: true });
  }

  reset() {
    if (this.timeline) {
      // Restore saved styles
      if (this.srcStyle) {
        this.src!.el.setAttribute("style", this.srcStyle!);
        this.dst!.el.setAttribute("style", this.dstStyle!);
      }
    }
  }

  run(offset: number): Observable<"transition:end"> {
    if (!this.timeline) {
      throw new Error("Transition not initialized");
    }

    const tl = this.timeline;

    return new Observable<"transition:end">((subscriber) => {
      tl.seek(offset / 1000);

      const handler = (ev: Event) => {
        // Restore original layer styles
        this.reset();
        subscriber.next("transition:end");
        subscriber.complete();
      };

      tl.eventCallback("onComplete", handler);

      tl.play();

      return () => {
        tl.eventCallback("onComplete", null);
        tl.kill();
      };
    });
  }

  seek(offset: number) {
    if (!this.timeline) {
      throw new Error("Transition not initialized");
    }
    const time = offset / 1000;
    this.timeline.seek(time);
  }
}
