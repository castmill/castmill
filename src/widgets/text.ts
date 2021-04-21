import { Widget } from "../widgets";
import { of } from "rxjs";
import { applyCss } from "../utils";

export class Text extends Widget {
  private div?: HTMLElement;
  private text: string;
  private css: Partial<CSSStyleDeclaration>;

  constructor(opts: { text: string; css: Partial<CSSStyleDeclaration> }) {
    super(opts);
    this.text = opts.text;
    this.css = opts.css;
  }

  show(el: HTMLElement, offset: number) {
    if (this.div) {
      return of("loaded");
    }
    const div = (this.div = document.createElement("div"));
    div.textContent = this.text;
    applyCss(div, this.css);

    el.appendChild(div);

    return of("loaded");
  }

  unload(): void {
    if (this.div) {
      this.div.parentElement?.removeChild(this.div);
      this.div = void 0;
    }
  }

  mimeType(): string {
    return "text";
  }
}
