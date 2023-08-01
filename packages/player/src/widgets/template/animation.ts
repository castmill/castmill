/**
 * Animation Module for Castmill Components
 *
 * This module provides a simple interface for animating components.
 *
 */
import gsap from "gsap";
import { Timeline, TimelineItem } from "./timeline";

export interface AnimationKeyframe {
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  set?: gsap.TweenVars;

  // Specific to text animation
  perspective?: number;
  chars?: boolean;
}

export interface ComponentAnimation {
  init?: Exclude<gsap.TimelineVars, "paused">;
  keyframes: AnimationKeyframe[];
}

export const applyAnimations = (
  timeline: Timeline,
  animations: ComponentAnimation[],
  target: HTMLElement | HTMLElement[]
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

    const tlItem = {
      start: timeline.duration(),
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
