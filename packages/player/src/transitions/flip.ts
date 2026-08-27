import { gsap } from 'gsap';

import { Layer } from '../layer';
import { GsapTransition } from './gsap-transition';

export class Flip extends GsapTransition {
  constructor(opts?: { duration: number; ease?: string }) {
    super(opts);
  }

  init(src: Layer, dst: Layer) {
    super.init(src, dst);

    const duration = this.duration / 1000;

    const hiddenVisibility = {
      'backface-visibility': 'hidden',
      '-webkit-backface-visibility': 'hidden',
    };

    gsap.set(src.el.parentElement, { perspective: 400 });

    const tl = this.timeline!;

    tl.set(src.el, hiddenVisibility);
    tl.set(dst.el, hiddenVisibility);

    tl.fromTo(
      src.el,
      { rotationY: 0 },
      { duration, rotationY: 180, ease: 'bounce' },
      0
    );
    tl.fromTo(
      dst.el,
      { rotationY: 180 },
      { duration, rotationY: 360, ease: 'bounce' },
      0
    );
  }
}
