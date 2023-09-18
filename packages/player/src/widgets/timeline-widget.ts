import { ResourceManager } from "@castmill/cache";
import { of, Observable, concat } from "rxjs";

import { Widget } from "./widget";
import { Timeline } from "./template/timeline";

/**
 * A Widget base class for widgets that want to use timelines for
 * effects and animations.
 *
 * Subclasses must instantiate a timeline and assign it to `this.timeline`
 * in the constructor.
 *
 */
export class TimelineWidget extends Widget {
  protected timeline: Timeline;
  protected offset: number = 0;

  constructor(resourceManager: ResourceManager, opts?: {}) {
    super(resourceManager, opts);

    this.timeline = new Timeline("root", { loop: true });
  }

  play(timer$: Observable<number>) {
    if (this.timeline.duration() > 0) {
      this.timeline.play(this.offset);
    }

    // We must concat with super.play(timer$) so that slack/duration is also taken into account.
    return concat(
      new Observable<string>((subscriber) => {
        const handler = (ev: Event) => {
          subscriber.next("played");
          subscriber.complete();
        };

        return () => {
          this.timeline?.pause();
        };
      }),
      super.play(timer$)
    );
  }

  stop() {
    this.timeline.pause();
  }

  seek(offset: number): Observable<[number, number]> {
    this.offset = offset;
    this.timeline.seek(offset);
    return of([offset, 0]);
  }

  duration(): number {
    return this.timeline.duration() || 0;
  }
}
