import { Observable } from "rxjs";
import { gsap } from "gsap";

import { Transition } from "./transition";
import { Layer } from "../layer";

export class Flip extends Transition {
  constructor(opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  run(src: Layer, dst: Layer) {
    const duration = this.duration / 1000;

    const initialVars = {
      rotationY: 0,
      "backface-visibility": "visible",
      "-webkit-backface-visibility": "visible",
    };

    return new Observable<"transition:end">((subscriber) => {
      const tl = gsap.timeline();

      const hiddenVisibility = {
        "backface-visibility": "hidden",
        "-webkit-backface-visibility": "hidden",
      };

      gsap.set(src.el.parentElement, { perspective: 400 });

      tl.set(src.el, hiddenVisibility);
      tl.set(dst.el, hiddenVisibility);

      tl.fromTo(
        src.el,
        { rotationY: 0 },
        { duration, rotationY: 180, ease: "bounce" },
        0
      );
      tl.fromTo(
        dst.el,
        { rotationY: 180 },
        { duration, rotationY: 360, ease: "bounce" },
        0
      );

      const handler = (ev: Event) => {
        subscriber.next("transition:end");
        subscriber.complete();
      };

      tl.eventCallback("onComplete", handler);

      return () => {
        tl.eventCallback("onComplete", null);
        gsap.set(src.el, initialVars);
        gsap.set(dst.el, initialVars);
        tl.pause();
        tl.kill();
      };
    });

    //      tl.to(src.el, { duration: duration / 2, z: 50 }, 0);
    //      tl.to(src.el, { duration: duration / 2, z: 0 }, 0.5);
  }
}
