import EventEmitter from "eventemitter3";
import { Observable, Subscription } from "rxjs";
import { finalize, share, tap, take, concatMap } from "rxjs/operators";
import { Playlist } from "./playlist";
import { Renderer } from "./renderer";

const TIMER_RESOLUTION = 50;

export class Player extends EventEmitter {
  constructor(private playlist: Playlist, private renderer: Renderer) {
    super();
  }
  timerSubscription?: Subscription;
  playing?: Subscription;

  show() {}

  toggleDebug() {
    this.renderer.toggleDebug();
    this.playlist.toggleDebug();
  }

  // For Video Wall / Mosaic use on wrapper: right: -100%, width: 200%
  // use Data.now() instead of this.playlist.time
  play(opts: { loop?: boolean } = { loop: false }) {
    // let currTime = (this.playlist.time || 0) % this.playlist.duration();
    /// (this.playlist.time || Date.now()) % this.playlist.duration();
    const timer$ = this.playlist.seek(this.playlist.time || 0).pipe(
      take(1),
      concatMap(([time, duration]) => {
        let currTime = time;
        return timer(this.playlist.time || 0, TIMER_RESOLUTION, duration).pipe(
          tap((value) => {
            // Unsure why this is needed
            if (value < currTime) {
              this.emit("end");
            }
            currTime = value;
          }),
          finalize(() => console.log("Timer completed!"))
        );
      }),
      share()
    );

    this.timerSubscription = timer$.subscribe({
      next: (time) => this.emit("time", time),
      error: (err) => {
        console.log("Timer error", err);
      },
    });

    this.playing = this.playlist
      .play(this.renderer, timer$, { loop: opts?.loop })
      .pipe(
        finalize(() => {
          this.timerSubscription?.unsubscribe();
          console.log("DONE PLAYING");
        })
      )
      .subscribe({
        error: (err) => {
          console.log("Playing error", err);
        },
        complete: () => {
          this.timerSubscription?.unsubscribe();
          this.emit("completed");
        },
      });
  }

  stop() {
    this.timerSubscription?.unsubscribe();
    this.playing?.unsubscribe();
  }
}

// Custom timer. Simpler than RxJS and more accurate.
function timer(start: number, interval: number, period: number) {
  return new Observable<number>((subscriber) => {
    let baseline = Date.now();
    let timeout = 0;
    let tick = start;
    const updateTick = () => {
      subscriber.next(tick);
      tick = (tick + interval) % period;
      baseline = baseline + interval;
      const drift = baseline - Date.now();
      timeout = setTimeout(updateTick, interval + drift);
    };
    updateTick();

    return () => {
      clearTimeout(timeout);
    };
  });
}
