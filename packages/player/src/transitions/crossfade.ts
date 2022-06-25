import { Observable } from "rxjs";
import { gsap } from "gsap";

import { Transition } from "./transition";
import { Layer } from "../layer";

export class CrossFade extends Transition {
  constructor(opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  run(src: Layer, dst: Layer) {
    const duration = this.duration / 1000;

    return new Observable<"transition:end">((subscriber) => {
      const tl = gsap.timeline({ paused: true });

      tl.fromTo(src.el, { opacity: 1, zIndex: 0 }, { opacity: 0, duration });
      tl.fromTo(dst.el, { opacity: 0, zIndex: 1 }, { opacity: 1, duration }, 0);

      const handler = (ev: Event) => {
        subscriber.next("transition:end");
        subscriber.complete();
      };

      tl.eventCallback("onComplete", handler);

      tl.play();

      return () => {
        tl.eventCallback("onComplete", null);
        gsap.set(dst.el, { opacity: 1, zIndex: 0 });

        // Restore src layer style
        gsap.set(src.el, { opacity: 1, zIndex: 0 });
        tl.kill();
      };
    });
  }
}
