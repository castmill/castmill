import { Observable } from "rxjs";
import { Transition } from "./transition.interface";
import { gsap } from "gsap";
import { Layer } from "../layer";

export class CrossFade implements Transition {
  run(src: Layer, dst: Layer, opts: { duration: number }) {
    return new Observable<"transition:end">((subscriber) => {
      gsap.set(dst.el, { opacity: 0, zIndex: "2000" });
      const dstTween = gsap.to(dst.el, {
        opacity: 1,
        duration: opts.duration / 1000,
      });
      const srcTween = gsap.to(src.el, {
        opacity: 0,
        duration: opts.duration / 1000,
        onComplete: () => {
          // NOTE: We need to emit one event when the transition has completed
          subscriber.next("transition:end");
          subscriber.complete();
        },
      });
      return () => {
        dstTween.kill();
        srcTween.kill();
        gsap.set(dst.el, { opacity: 1, zIndex: "2000" });
      };
    });
  }
}
