import { Widget } from "./widget";
import { fromEvent, merge, race, Observable, of, iif } from "rxjs";
import {
  map,
  take,
  tap,
  switchMap,
  share,
  timeout,
  subscribeOn,
} from "rxjs/operators";

enum ReadyState {
  HAVE_NOTHING = 0, // No information is available about the media resource.
  HAVE_METADATA = 1, //	Enough of the media resource has been retrieved that the metadata attributes are initialized. Seeking will no longer raise an exception.
  HAVE_CURRENT_DATA = 2, // Data is available for the current playback position, but not enough to actually play more than one frame.
  HAVE_FUTURE_DATA = 3, // Data for the current playback position as well as for at least a little bit of time into the future is available (in other words, at least two frames of video, for example).
  HAVE_ENOUGH_DATA = 4, // Enough data is available—and the download rate is high enough—that the media can be played through to the end without interruption.
}

export class Video extends Widget {
  private video?: HTMLVideoElement;
  private src: string;
  private _volume: number;
  private _duration: number = 0;

  offset: number = 0;

  constructor(opts: { src: string; volume: number }) {
    super();
    this.src = opts.src;
    this._volume = opts.volume;
  }

  show(el: HTMLElement, offset: number) {
    return this.load().pipe(
      switchMap((video) => {
        this.offset = offset;
        video.currentTime = offset / 1000;
        el.appendChild(video);
        return of("shown");
      })
    );
  }

  private load(): Observable<HTMLVideoElement> {
    const video = this.video
      ? this.video
      : (this.video = document.createElement("video") as HTMLVideoElement);
    video.style.width = "100%";
    video.style.height = "100%";
    video.src = this.src;

    if (typeof this._volume !== "undefined") {
      this.volume(this._volume);
    }

    let loading$: Observable<HTMLVideoElement>;
    if (video.readyState < ReadyState.HAVE_ENOUGH_DATA) {
      video.load();

      loading$ = fromEvent(video, "canplaythrough").pipe(
        take(1),
        map((evt) => video)
      );
    } else {
      loading$ = of(video);
    }

    return loading$;
  }

  // TODO: A correct unload should wait for a load before it tries to unload.
  unload(): void {
    console.log(`Unloading video ${this.src}`);
    if (this.video) {
      // this.video.src = "";
      this.video.parentElement?.removeChild(this.video);
      this.video = void 0;
    }
  }

  play(timer$: Observable<number>) {
    return this.load().pipe(
      switchMap(() => {
        if (this.video) {
          const video = this.video;
          const playPromise = video.play();

          if (playPromise) {
            playPromise.catch((err) => {
              console.log(`Video play error: ${err}`);
            });
          }

          return fromEvent(video, "playing").pipe(
            take(1),
            switchMap(() =>
              race(
                //  Dummy observable that pauses if the playing observable gets
                // unsubscribed, required for pausing the video.
                new Observable<string>((subscriber) => {
                  return () => {
                    video.pause();
                  };
                }),
                super.play(timer$)
              )
            )

            // The problem with letting the "ended" event
            // decide that the video is over is that it could
            // finish *before* the actual duration of the video,
            // when this happens the timer$ gets out of sync and the
            // content is not player correctly. This happens often when
            // doing a seek before playing the content...
            /*
            switchMap(() =>
              race(
                new Observable<string>((subscriber) => {
                  // Probably we do not need this event listener at all.
                  const handler = (ev: Event) => {
                    subscriber.next("played");
                    subscriber.complete();
                    console.log("Played ended");
                  };

                  video.addEventListener("ended", handler);

                  return () => {
                    video.removeEventListener("ended", handler);
                    video.pause();
                  };
                }),
                super.play(timer$)
              ).pipe(
                tap((value) => {
                  console.log(`Video played: ${value}`);
                })
              )
            )
            */
          );
        }
        return super.play(timer$);
      })
    );
  }

  stop() {
    this.video?.pause();
  }

  seek(offset: number): Observable<[number, number]> {
    this.offset = offset;
    if (this.video && this.video.readyState >= ReadyState.HAVE_METADATA) {
      this.video.currentTime = offset / 1000;

      return fromEvent(this.video, "seeked").pipe(
        take(1),
        // Timeout for slow or video tags not implementing seeked event.
        timeout(250),
        map((evt) => [offset, 0])
      );
    }
    return of([offset, 0]);
  }

  volume(volume: number) {
    if (this.video) {
      this._volume = this.video.volume = volume;
    }
  }

  duration(): Observable<number> {
    if (this._duration) {
      return of(this._duration);
    }

    let video = this.video;
    if (!video) {
      video = document.createElement("video");
      video.preload = "metadata";
      video.src = this.src;
    }

    return fromEvent(video, "loadedmetadata").pipe(
      take(1),
      map((evt) => {
        if (video) {
          this._duration = (video?.duration ?? 0) * 1000;
          video.src = "";
        }
        return this._duration;
      })
    );
  }

  mimeType(): string {
    return "video/mpeg4";
  }
}
