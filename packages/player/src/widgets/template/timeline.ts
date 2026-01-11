import { gsap } from 'gsap';

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
  // Start time in milliseconds.
  start: number;

  // Enable repeat for this child
  repeat?: boolean;

  // This duration overrides the duration of the child.
  duration?: number;

  // The child timeline.
  child: TimelineBasic;
}

export class Timeline implements TimelineBasic {
  time: number = 0;

  items: TimelineItem[] = [];

  playing: Set<TimelineItem> = new Set();
  nextEndTick: number = 0;

  intervalTimer: ReturnType<typeof setInterval> | undefined;

  private opts: { loop?: boolean; duration?: number };

  // Any item has repeat enabled.
  private hasRepeat: boolean = false;

  constructor(
    public name: string,
    opts: { loop?: boolean; duration?: number } = {}
  ) {
    // Copy opts to prevent side effects.
    this.opts = {
      ...opts,
    };
  }

  setLoop(loop: boolean) {
    this.opts.loop = loop;
  }

  setDuration(duration: number) {
    this.opts.duration = duration;
  }

  play(offset: number = 0) {
    this.clearInterval();

    const basetime = Date.now();
    this.time = offset;
    let prevPosition = 0;

    // If duration is 0 (e.g., empty timeline or items not yet added),
    // still proceed - items may be added dynamically (like LayoutContainers)

    const tick = () => {
      try {
        // Recalculate duration each tick since items may be added dynamically
        const currentDuration = this.duration();

        let time = Date.now() - basetime + offset;
        if (currentDuration > 0 && time >= currentDuration && !this.opts.loop) {
          this.pause();
          return;
        }

        // Use time directly if duration is 0 or if we have repeat items
        // (repeat items don't use modulo, they just keep playing)
        const position = (this.time =
          this.hasRepeat || currentDuration === 0
            ? time
            : time % currentDuration);

        // Check if we have looped around.
        if (position < prevPosition) {
          this.nextEndTick = 0;
          // When looping, we need to reset all items so they can be replayed
          this.playing.forEach((item) => {
            if (!item.repeat) {
              // Non-repeat items get paused and moved back to items list
              this.pauseItem(item);
            } else {
              // Repeat items need to be restarted from the looped position
              // Calculate the offset for the repeat item
              const duration = item.duration || this.childDuration(item);
              const effectivePosition = position - item.start;
              const childOffset =
                duration > 0 ? effectivePosition % duration : 0;

              // For GSAP timelines with infinite repeat (-1), don't restart - let them continue
              // They handle their own looping internally
              if (item.child instanceof gsap.core.Timeline) {
                const gsapTimeline = item.child as gsap.core.Timeline;
                if (gsapTimeline.repeat() === -1) {
                  // Infinite repeat - just let it continue, don't restart
                  return;
                }
                // Finite or no repeat - seek to position then play
                // Using seek + play instead of restart + seek to avoid race condition
                gsapTimeline.seek(childOffset / 1000);
                gsapTimeline.play();
              } else {
                item.child.seek(childOffset);
                item.child.play(childOffset);
              }
            }
          });
        }

        // Pause items that should no longer be playing and move them back to the items list.
        if (position >= this.nextEndTick) {
          let nextEndTick = Number.MAX_SAFE_INTEGER;
          this.playing.forEach((item) => {
            if (item.repeat) {
              return;
            }

            const end =
              item.start + (item.duration || this.childDuration(item));
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
      } catch (e) {
        console.error(e);
      }
    };

    // Every 100 ms we will check if we need to stop or start any items.
    this.intervalTimer = setInterval(tick, 100);
    tick();
  }

  private playItemsFrom(position: number) {
    const itemsToPlay = this.items.filter((item) => {
      if (item.repeat) {
        return item.start <= position;
      } else {
        const duration = item.duration || this.childDuration(item);
        const end = item.start + duration;
        // For items with duration 0, consider them always playable once their start time is reached
        // This handles cases like LayoutContainer where duration is dynamic/unknown
        if (duration === 0) {
          return item.start <= position;
        }
        return item.start <= position && end > position;
      }
    });

    // Play all items that are within the current position.
    itemsToPlay.forEach((item) => {
      const duration = item.duration || this.childDuration(item);
      let effectivePosition = position - item.start;

      this.items.splice(this.items.indexOf(item), 1);
      this.playing.add(item);

      // Only update nextEndTick if duration > 0
      if (duration > 0) {
        this.nextEndTick = Math.min(this.nextEndTick, item.start + duration);
      }

      // Calculate the offset to pass to the child
      // For GSAP timelines, convert ms to seconds
      // For repeat items, use modulo (but only if duration > 0 to avoid NaN)
      // For regular items, use effectivePosition directly
      let childOffset: number;
      if (item.child instanceof gsap.core.Timeline) {
        childOffset = effectivePosition / 1000;
      } else if (item.repeat && duration > 0) {
        childOffset = effectivePosition % duration;
      } else {
        // For repeat items with duration 0, just use 0 as offset
        // (the child timeline will start from the beginning)
        childOffset = duration > 0 ? effectivePosition : 0;
      }

      // For GSAP timelines with infinite repeat that are already playing,
      // don't restart them - let them continue seamlessly
      if (item.child instanceof gsap.core.Timeline) {
        const gsapTimeline = item.child as gsap.core.Timeline;
        if (gsapTimeline.repeat() === -1 && gsapTimeline.isActive()) {
          // Already playing with infinite repeat - just continue
          return;
        }
        // Seek to the correct position first, then play
        // This avoids the restart() + seek() race condition where the animation
        // might render a frame at position 0 before seeking to the correct offset
        gsapTimeline.seek(childOffset);
        gsapTimeline.play();
      } else {
        item.child.play(childOffset);
      }
    });
  }

  private pauseItem(item: TimelineItem, force = false) {
    // For GSAP timelines with infinite repeat that are actively playing,
    // don't pause them during normal playback - they should continue seamlessly.
    // But if force is true (explicit pause()), always pause.
    if (!force && item.child instanceof gsap.core.Timeline) {
      const gsapTimeline = item.child as gsap.core.Timeline;
      if (gsapTimeline.repeat() === -1 && gsapTimeline.isActive()) {
        // Don't pause infinite repeat timelines and keep them in playing set.
        // Don't move to items list - they should just keep running.
        return;
      }
    }
    item.child.pause();
    this.playing.delete(item);
    this.items.push(item);
    this.items.sort((a, b) => a.start - b.start);
  }

  seek(offset: number) {
    // If there are still playing items, pause them first
    // This can happen when seek is called during cleanup/restart scenarios
    if (this.playing.size !== 0) {
      this.pause();
    }
    this.time = offset;

    this.items.forEach((item) => {
      // Skip infinite-repeat GSAP timelines that are actively playing
      // They handle their own looping and shouldn't be seeked externally
      if (item.child instanceof gsap.core.Timeline) {
        const gsapTimeline = item.child as gsap.core.Timeline;
        if (gsapTimeline.repeat() === -1 && gsapTimeline.isActive()) {
          return;
        }
      }

      const end = item.start + (item.duration || this.childDuration(item));
      const relativeOffset = offset - item.start;
      if (offset < item.start) {
        return;
      }

      const hasRepeatCycle = Boolean(item.repeat && item.duration);
      const itemDuration = item.duration || this.childDuration(item);
      let targetOffset: number;

      if (hasRepeatCycle && item.duration) {
        targetOffset = relativeOffset % item.duration;
      } else {
        const clamped = Math.min(Math.max(relativeOffset, 0), itemDuration);
        targetOffset = clamped;
      }

      item.child.seek(
        item.child instanceof gsap.core.Timeline
          ? targetOffset / 1000
          : targetOffset
      );
    });
  }

  private childDuration(item: TimelineItem) {
    const duration = item.child.duration();
    return item.child instanceof gsap.core.Timeline
      ? duration * 1000
      : duration;
  }

  pause() {
    this.clearInterval();
    this.nextEndTick = 0;
    this.playing.forEach((item) => {
      this.pauseItem(item, true); // Force pause all items, including infinite-repeat
    });
  }

  add(item: TimelineItem) {
    if (item.repeat) {
      this.hasRepeat = true;
    }
    this.items.push(item);
    this.items.sort((a, b) => a.start - b.start);
  }

  remove(item: TimelineItem) {
    const index = this.items.findIndex((_item) => _item === item);
    if (index >= 0) {
      this.items.splice(index, 1);
      this.hasRepeat = this.items.some((item) => item.repeat);
    }
  }

  isPlaying(item: TimelineItem) {
    return this.playing.has(item);
  }

  /**
   * Check if this timeline is currently running (has an active interval timer).
   */
  isRunning() {
    return !!this.intervalTimer;
  }

  duration() {
    // Return static duration if explicitly set
    if (this.opts.duration) {
      return this.opts.duration;
    }

    // Calculate duration from all items.
    // For repeat items, use their explicit duration if set (one loop cycle).
    // This gives us the total duration for one complete playthrough.
    const itemsDuration = this.items.reduce((acc: number, item) => {
      // For repeat items, only count them if they have an explicit duration
      // (representing one loop cycle). Repeat items without duration play indefinitely.
      if (item.repeat) {
        if (item.duration) {
          return Math.max(acc, item.start + item.duration);
        }
        return acc; // Skip repeat items without explicit duration
      }
      return Math.max(
        acc,
        item.start + (item.duration || this.childDuration(item))
      );
    }, 0);

    const playingDuration = [...this.playing].reduce((acc: number, item) => {
      if (item.repeat) {
        if (item.duration) {
          return Math.max(acc, item.start + item.duration);
        }
        return acc;
      }
      return Math.max(
        acc,
        item.start + (item.duration || this.childDuration(item))
      );
    }, 0);

    return Math.max(itemsDuration, playingDuration);
  }

  private clearInterval() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }
}
