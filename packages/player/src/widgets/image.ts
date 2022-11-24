import { ResourceManager } from "@castmill/cache";
import { from, Observable, of } from "rxjs";
import { switchMap } from "rxjs/operators";
import { TimelineWidget } from "./timeline-widget";
export class Image extends TimelineWidget {
  private img?: HTMLElement;
  private src: string;
  private size?: string;

  constructor(
    resourceManager: ResourceManager,
    opts: { src: string; size?: "contain" | "cover" }
  ) {
    super(resourceManager, opts);
    this.src = opts.src;
    this.size = opts.size;
  }

  private load(url: string) {
    return new Observable<string>((subscriber) => {
      const dummy = document.createElement("img");
      dummy.src = url;

      dummy.onload = (ev: Event) => {
        subscriber.next("loaded");
        subscriber.complete();
      };

      dummy.onerror = (ev: Event | string) => {
        subscriber.error("error");
      };

      return () => {
        dummy.onerror = null;
        dummy.onload = null;
      };
    });
  }

  show(el: HTMLElement, offset: number) {
    if (!this.img) {
      this.img = document.createElement("div");
    } else if (this.img.style.background) {
      return of("shown");
    }

    return from(this.resourceManager.getMedia(this.src)).pipe(
      switchMap((url) => {
        const img = this.img!;
        img.style.background = `url( ${url || this.src} ) no-repeat center`;
        img.style.backgroundSize = this.size ? this.size : "contain";
        img.style.width = "100%";
        img.style.height = "100%";

        el.appendChild(img);

        return this.load(url || this.src);

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
      })
    );
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
