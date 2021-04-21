import { Observable } from "rxjs";
import { Layer } from "../layer";

export interface Transition {
  run(
    src: Layer,
    dst: Layer,
    opts: { duration: number }
  ): Observable<"transition:end">;
}
