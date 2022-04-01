import { gsap } from "gsap";
import { of, Observable, concat } from "rxjs";

import { Widget } from "./widget";

/**
 * A Widget base class for widgets that want to use Gsap timelines for
 * effects and animations.
 *
 * Subclasses must instantiate a timeline and assign it to `this.timeline`
 * in the constructor.
 *
 */
export class TimelineWidget extends Widget {
  protected timeline?: gsap.core.Timeline;
  protected offset: number = 0;

  constructor(opts?: {}) {
    super(opts);
    this.timeline = gsap.timeline({ paused: true });
  }

  play(timer$: Observable<number>) {
    if (this.timeline) {
      this.timeline.play(this.offset / 1000);

      // We must concat with super.play(timer$) so that slack/duration is also taken into account.
      return concat(
        new Observable<string>((subscriber) => {
          const handler = (ev: Event) => {
            subscriber.next("played");
            subscriber.complete();
          };

          this.timeline?.eventCallback("onComplete", handler);

          return () => {
            this.timeline?.eventCallback("onComplete", null);
            this.timeline?.pause();
          };
        }),
        super.play(timer$)
      );
    }
    return super.play(timer$);
  }

  stop() {
    this.timeline?.pause();
  }

  seek(offset: number): Observable<[number, number]> {
    this.offset = offset;
    this.timeline?.seek(offset / 1000);
    return of([offset, 0]);
  }

  duration(): Observable<number> {
    return of((this.timeline?.duration() || 0) * 1000);
  }
}
