import { Observable } from "rxjs";
import { Layer } from "../layer";

export abstract class Transition {
  duration: number = 1000;
  abstract run(src: Layer, dst: Layer): Observable<"transition:end">;

  constructor(opts?: { duration?: number }) {
    if (opts) {
      this.duration = opts.duration ?? this.duration;
    }
  }
}
