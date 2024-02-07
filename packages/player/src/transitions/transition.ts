import { Observable } from 'rxjs'
import { Layer } from '../layer'

export abstract class Transition {
  duration: number = 1000

  abstract init(src: Layer, dst: Layer): void
  abstract reset(): void
  abstract run(time: number): Observable<'transition:end'>
  abstract seek(offset: number): void

  constructor(opts?: { duration?: number }) {
    if (opts) {
      this.duration = opts.duration ?? this.duration
    }
  }
}
