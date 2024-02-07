import { Observable } from 'rxjs'
import { Layer } from '../layer'

export interface JsonEffect {
  uri: string
  args?: object
}

/**
 * Effect abstract class.
 *
 * Effects can be applied on a running widget. While a transition is running between
 * layers, effects are applied on the layer itself.
 *
 */
export abstract class Effect {
  static async fromJSON(json: JsonEffect) {
    switch (json.uri) {
    }
  }

  abstract run(
    src: Layer,
    dst: Layer,
    opts: { duration: number }
  ): Observable<'transition:end'>
}
