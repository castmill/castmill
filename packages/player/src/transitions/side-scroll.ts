import { Layer } from "../layer";
import { GsapTransition } from "./gsap-transition";

export class SideScroll extends GsapTransition {
  constructor(private opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  init(src: Layer, dst: Layer) {
    super.init(src, dst);

    const duration = this.duration / 1000;

    const ease = this.opts?.ease ?? "power1.inOut";

    this.timeline!.fromTo(
      src.el,
      { opacity: 1, zIndex: 0 },
      { opacity: 0, duration }
    );
    this.timeline!.fromTo(
      dst.el,
      { left: "100%", zIndex: 1 },
      { left: 0, duration },
      0
    );
  }
}
