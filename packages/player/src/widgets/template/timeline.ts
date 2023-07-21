import gsap from "gsap";

/**
 * This class represents a timeline.
 * It is very similar to GSAP's Timeline but includes some hooks that are useful
 * for Castmill widgets.
 */
export interface TimelineBasic {
  play(offset: number): void;
  seek(offset: number): void;
  pause(): void;
  duration(): number;
}

export interface TimelineItem {
  start: number;
  duration?: number; // This duration overrides the duration of the child.
  child: TimelineBasic;
}

export class Timeline implements TimelineBasic {
  time: number = 0;

  items: TimelineItem[] = [];

  playing: Set<TimelineItem> = new Set();
  nextEndTick: number = 0;

  intervalTimer: any;

  constructor(
    public name: string,
    private opts: { loop?: boolean; duration?: number } = {}
  ) {}

  play(offset: number = 0) {
    this.clearInterval();

    const basetime = Date.now();
    this.time = offset;
    let prevPosition = 0;

    const tick = () => {
      let time = Date.now() - basetime + offset;
      const duration = this.duration();
      if (time >= duration && !this.opts.loop) {
        this.pause();
        return;
      }

      const position = (this.time = time % duration);
      // Check if we have looped around.
      if (position < prevPosition) {
        this.nextEndTick = 0;
      }

      // Pause items that should no longer be playing and move them back to the items list.
      if (position >= this.nextEndTick) {
        let nextEndTick = Number.MAX_SAFE_INTEGER;
        this.playing.forEach((item) => {
          const end = item.start + (item.duration || this.childDuration(item));
          if (position < item.start || position >= end) {
            this.pauseItem(item);
          } else {
            nextEndTick = Math.min(nextEndTick, end);
          }
        });
        this.nextEndTick = nextEndTick;
      }

      prevPosition = position;
      this.playItemsFrom(position);
    };

    // Every 100 ms we will check if we need to stop or start any items.
    this.intervalTimer = setInterval(() => tick, 100);
    tick();
  }

  private playItemsFrom(position: number) {
    const itemsToPlay = this.items.filter((item) => {
      const duration = item.duration || this.childDuration(item);
      const end = item.start + duration;
      return item.start <= position && end > position;
    });

    // Play all items that are within the current position.
    itemsToPlay.forEach((item) => {
      const end = item.start + (item.duration || this.childDuration(item));
      this.items.splice(this.items.indexOf(item), 1);
      this.playing.add(item);

      this.nextEndTick =
        this.nextEndTick === 0 && end ? end : Math.min(this.nextEndTick, end);

      const relativePosition = position - item.start;
      item.child.play(
        item.child instanceof gsap.core.Timeline
          ? relativePosition / 1000
          : relativePosition
      );
    });
  }

  private pauseItem(item: TimelineItem) {
    item.child.pause();
    this.playing.delete(item);
    this.items.push(item);
    this.items.sort((a, b) => a.start - b.start);
  }

  seek(offset: number) {
    if (this.playing.size !== 0) {
      throw new Error("Cannot seek while playing");
    }
    this.time = offset;

    this.items.forEach((item) => {
      const end = item.start + (item.duration || this.childDuration(item));
      if (offset >= item.start && offset <= end) {
        const relativeOffset = offset - item.start;
        item.child.seek(
          item.child instanceof gsap.core.Timeline
            ? relativeOffset / 1000
            : relativeOffset
        );
      }
    });
  }

  private childDuration(item: TimelineItem) {
    const duration = item.child.duration();
    item.child instanceof gsap.core.Timeline ? duration * 1000 : duration;
    return duration;
  }

  pause() {
    this.clearInterval();
    this.nextEndTick = 0;
    this.playing.forEach((item) => {
      this.pauseItem(item);
    });
  }

  add(item: TimelineItem) {
    this.items.push(item);
    this.items.sort((a, b) => a.start - b.start);
  }

  remove(item: TimelineItem) {
    const index = this.items.findIndex((_item) => item === item);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  isPlaying(item: TimelineItem) {
    return this.playing.has(item);
  }

  duration() {
    // Since a timeline item could change its duration after it has been added
    // we have no other option than to recalculate the duration every time.
    return (
      this.opts.duration ||
      this.items.reduce(
        (acc: number, item) =>
          Math.max(
            acc,
            item.start + (item.duration || this.childDuration(item))
          ),
        0
      )
    );
  }

  private clearInterval() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }
}
