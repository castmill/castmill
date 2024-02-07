import EventEmitter from 'eventemitter3'
import { Observable, Subscription } from 'rxjs'
import { finalize, share, tap, first, concatMap } from 'rxjs/operators'
import { Playlist } from './playlist'
import { Renderer, Viewport } from './renderer'

const TIMER_RESOLUTION = 50

/**
 * Viewport
 *
 * Defines the visible area for the player.
 * It is possible to create playlists than can be shared with several players, but where each player
 * only shows a small area (defined by the viewport). This can be used for creating video walls for example.
 *
 */

export class Player extends EventEmitter {
  constructor(
    private playlist: Playlist,
    private renderer: Renderer,
    viewport?: Viewport
  ) {
    super()

    if (viewport) {
      renderer.setViewport(viewport)
    }
  }
  timerSubscription?: Subscription
  playing?: Subscription

  show() {}

  toggleDebug() {
    this.renderer.toggleDebug()
    this.playlist.toggleDebug()
  }

  play(
    opts: { loop?: boolean; synced?: boolean; baseline?: number } = {
      loop: false,
      synced: false,
    }
  ) {
    // Define the baseline time for the timer
    const baseline = opts.baseline || Date.now()

    this.stop()

    // Do we really need to seek here, since we also seek when doing "show"?
    const startTime = opts.synced ? baseline : this.playlist.time || 0
    const timer$ = this.playlist.seek(startTime).pipe(
      first(),
      concatMap(([time, duration]) => {
        let currTime = time
        return timer(baseline, startTime, TIMER_RESOLUTION, duration).pipe(
          tap((value) => {
            // Unsure why this is needed
            if (value < currTime) {
              this.emit('end')
            }
            currTime = value
          })
        )
      }),
      share()
    )

    this.timerSubscription = timer$.subscribe({
      next: (time) => this.emit('time', time),
      error: (err) => {
        console.log('Timer error', err)
      },
    })

    this.playing = this.playlist
      .play(this.renderer, timer$, {
        loop: opts?.loop,
      })
      .pipe(
        finalize(() => {
          this.timerSubscription?.unsubscribe()
        })
      )
      // Note for the future: for some reason, this subscribe call is a bit slow, between 10-40ms
      // on my machine. This is probably due to the fact that it is a cold observable, and the
      // first time it is subscribed to, it needs to be "hot" (i.e. start playing).
      // The amount of slowness seems to depend on the size of the playlist, and the complexity of the
      // playlist (i.e. how many layers, how many items in each layer, etc).
      .subscribe({
        error: (err) => {
          console.log('Playing error', err)
        },
        complete: () => {
          this.timerSubscription?.unsubscribe()
          this.emit('completed')
        },
      })
  }

  stop() {
    this.timerSubscription?.unsubscribe()
    this.playing?.unsubscribe()

    this.timerSubscription = void 0
    this.playing = void 0
  }
}

// Custom timer. Simpler than RxJS and more accurate.
export function timer(
  baseline: number,
  start: number,
  interval: number,
  period: number
) {
  return new Observable<number>((subscriber) => {
    let timeout = 0
    let tick = start
    const updateTick = () => {
      subscriber.next(tick)
      tick = (tick + interval) % period
      baseline = baseline + interval
      const drift = baseline - Date.now()
      timeout = setTimeout(updateTick, interval + drift)
    }
    updateTick()

    return () => {
      clearTimeout(timeout)
    }
  })
}
