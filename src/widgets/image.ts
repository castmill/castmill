import { Widget } from "../widgets";
import { Observable, of } from "rxjs";

export class Image extends Widget {
  private img?: HTMLElement;
  private src: string;

  constructor(opts: { src: string }) {
    super(opts);
    this.src = opts.src;
  }

  show(el: HTMLElement, offset: number) {
    if (this.img) {
      return of("loaded");
      // throw new Error("img element exists already");
    }
    const img = (this.img = document.createElement("div"));
    img.style.background = "url(" + this.src + ") no-repeat center";
    img.style.backgroundSize = "contain";
    img.style.width = "100%";
    img.style.height = "100%";

    el.appendChild(img);

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
