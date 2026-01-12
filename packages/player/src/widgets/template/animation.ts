/**
 * Animation Module for Castmill Components
 *
 * This module provides a simple interface for animating components.
 *
 */
import gsap from 'gsap';
import { Timeline, TimelineItem } from './timeline';

export interface AnimationKeyframe {
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  set?: gsap.TweenVars;

  // Specific to text animation
  perspective?: number;
  chars?: boolean;
}

export interface ComponentAnimation {
  init?: Exclude<gsap.TimelineVars, 'paused'>;
  keyframes: AnimationKeyframe[];
  /**
   * Start time in milliseconds. Default is 0 (play immediately).
   * Use negative values to position relative to the end of the parent duration.
   * For example, -1000 means "start 1 second before the end".
   */
  start?: number;
}

export const applyAnimations = (
  timeline: Timeline,
  animations: ComponentAnimation[],
  target: HTMLElement | HTMLElement[],
  /**
   * Parent duration in milliseconds. Used to resolve negative start times.
   * If not provided, negative start times will be treated as 0.
   */
  parentDuration?: number
) => {
  const addedItems: TimelineItem[] = [];
  const timelines: gsap.core.Timeline[] = [];

  animations.forEach((animation) => {
    const tl = gsap.timeline({ ...(animation.init || {}), paused: true });

    const keyframes = animation.keyframes;
    for (let i = 0; i < keyframes.length; i++) {
      const keyframe = keyframes[i];
      if (keyframe.from) {
        tl.from(target, keyframe.from);
      }
      if (keyframe.to) {
        tl.to(target, keyframe.to);
      }
      if (keyframe.set) {
        tl.set(target, keyframe.set);
      }
    }

    // Calculate the start time
    let startTime = animation.start || 0;
    if (startTime < 0 && parentDuration && parentDuration > 0) {
      // Negative start means relative to end
      startTime = Math.max(0, parentDuration + startTime);
    } else if (startTime < 0) {
      // No parent duration available, default to 0
      startTime = 0;
    }

    const tlItem = {
      start: startTime,
      duration: tl.duration() * 1000,
      repeat: !!tl.repeat(),
      child: tl,
    };

    timeline.add(tlItem);

    addedItems.push(tlItem);
    timelines.push(tl);
  });

  return function cleanUp() {
    addedItems.forEach((item) => {
      timeline.remove(item);
    });

    timelines.forEach((tl) => {
      tl.kill();
    });
  };
};
