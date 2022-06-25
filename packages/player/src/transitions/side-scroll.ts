import { Observable } from "rxjs";
import { gsap } from "gsap";

import { Transition } from "./transition";
import { Layer } from "../layer";

export class SideScroll extends Transition {
  constructor(private opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  run(src: Layer, dst: Layer) {
    const duration = this.duration / 1000;
    const ease = this.opts?.ease ?? "power1.inOut";

    return new Observable<"transition:end">((subscriber) => {
      const tl = gsap.timeline({ paused: true });

      tl.fromTo(src.el, { opacity: 1, zIndex: 0 }, { opacity: 0, duration });
      tl.fromTo(dst.el, { left: "100%", zIndex: 1 }, { left: 0, duration }, 0);

      const handler = (ev: Event) => {
        subscriber.next("transition:end");
        subscriber.complete();
      };

      tl.eventCallback("onComplete", handler);

      tl.play();

      return () => {
        tl.eventCallback("onComplete", null);
        gsap.set(dst.el, { left: 0, zIndex: 0 });

        // Restore src layer style
        gsap.set(src.el, { opacity: 1, zIndex: 0 });
        tl.kill();
      };
    });
  }
}
