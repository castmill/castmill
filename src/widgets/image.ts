import { Observable, of } from "rxjs";

import { TimelineWidget } from "./timeline-widget";

export class Image extends TimelineWidget {
  private img?: HTMLElement;
  private src: string;
  private size?: string;

  constructor(opts: { src: string; size?: "contain" | "cover" }) {
    super(opts);
    this.src = opts.src;
    this.size = opts.size;
  }

  show(el: HTMLElement, offset: number) {
    if (this.img) {
      return of("loaded");
      // throw new Error("img element exists already");
    }
    const img = (this.img = document.createElement("div"));
    img.style.background = "url(" + this.src + ") no-repeat center";
    img.style.backgroundSize = this.size ? this.size : "contain";
    img.style.width = "100%";
    img.style.height = "100%";

    el.appendChild(img);

    /** 
    // TODO: Allow specifying gsap timelines for any kind of effect.
    // For example, zoom-in-out animations, etc.
    const tl = (this.timeline = gsap.timeline({ paused: true }));

    tl.to(img, {
      "-webkit-filter": "hue-rotate(100deg) grayscale(1)",
      filter: "hue-rotate(100deg) grayscale(1)",
      ease: "back",
    });
    */

    return new Observable<string>((subscriber) => {
      const dummy = document.createElement("img");
      dummy.src = this.src;

      dummy.onload = (ev: Event) => {
        subscriber.next("loaded");
        subscriber.complete();
      };

      return () => {
        dummy.onload = null;
      };
    });
  }

  unload(): void {
    if (this.img) {
      this.img.style.background = "none";
      this.img.parentElement?.removeChild(this.img);
      this.img = void 0;
    }
  }

  mimeType(): string {
    return "image/jpeg";
  }
}
