import { Layer } from '../layer'
import { GsapTransition } from './gsap-transition'

export class CrossFade extends GsapTransition {
  constructor(opts?: { duration: number; ease?: string }) {
    super(opts)
  }

  init(src: Layer, dst: Layer) {
    super.init(src, dst)

    const duration = this.duration / 1000

    this.timeline!.fromTo(
      src.el,
      { opacity: 1, zIndex: 0 },
      { opacity: 0, duration }
    )
    this.timeline!.fromTo(
      dst.el,
      { opacity: 0, zIndex: 1 },
      { opacity: 1, duration },
      0
    )
  }
}
