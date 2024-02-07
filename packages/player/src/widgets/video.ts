import { Widget } from './widget'
import { fromEvent, race, Observable, of, from } from 'rxjs'
import { map, take, switchMap, timeout, tap, first } from 'rxjs/operators'
import { ResourceManager } from '@castmill/cache'

enum ReadyState {
  HAVE_NOTHING = 0, // No information is available about the media resource.
  HAVE_METADATA = 1, //	Enough of the media resource has been retrieved that the metadata attributes are initialized. Seeking will no longer raise an exception.
  HAVE_CURRENT_DATA = 2, // Data is available for the current playback position, but not enough to actually play more than one frame.
  HAVE_FUTURE_DATA = 3, // Data for the current playback position as well as for at least a little bit of time into the future is available (in other words, at least two frames of video, for example).
  HAVE_ENOUGH_DATA = 4, // Enough data is available—and the download rate is high enough—that the media can be played through to the end without interruption.
}

export class Video extends Widget {
  private video?: HTMLVideoElement
  private src: string
  private _volume: number
  private _duration: number = 0

  offset: number = 0

  // private $loading: Observable<HTMLVideoElement>;
  // private lastUrl: string;

  constructor(
    resourceManager: ResourceManager,
    opts: { src: string; volume: number }
  ) {
    super(resourceManager)
    this.src = opts.src
    this._volume = opts.volume
  }

  show(el: HTMLElement, offset: number) {
    return this.load().pipe(
      switchMap(() => {
        el.appendChild(this.video!)
        return this.seek(offset).pipe(map(() => 'shown'))
      })
    )
  }

  // TODO: We need to refactor "load" as a widget method.
  // The reason is that we need to do all the heavy stuff before we actually start
  // playing the video, so that we can do an efficient seek before playing and
  // compensate for drift, etc.
  load(): Observable<string> {
    if (!this.video) {
      const video = (this.video = document.createElement(
        'video'
      ) as HTMLVideoElement)
      video.style.width = '100%'
      video.style.height = '100%'
      video.loop = true
    } else if (this.video.src) {
      return of('video:loaded')
    }

    if (typeof this._volume !== 'undefined') {
      this.volume(this._volume)
    }

    return from(this.resourceManager.getMedia(this.src)).pipe(
      switchMap((url) => {
        const video = this.video!
        url = url || this.src
        video.src = url

        let loading$: Observable<string>
        if (video.readyState < ReadyState.HAVE_ENOUGH_DATA) {
          loading$ = new Observable<string>((subscriber) => {
            const handler = (ev: Event) => {
              subscriber.next('video:loaded')
              subscriber.complete()
            }

            const errorHandler = (ev: Event) => {
              subscriber.error('error')
            }

            video.addEventListener('canplaythrough', handler)
            video.addEventListener('error', errorHandler)

            return () => {
              video.removeEventListener('canplaythrough', handler)
            }
          })
          video.load()
        } else {
          loading$ = of('vide0:loaded')
        }
        return loading$
      })
    )
  }

  // TODO: A correct unload should wait for a load before it tries to unload.
  unload(): void {
    if (this.video) {
      this.video.src = ''
      this.video.parentElement?.removeChild(this.video)
      this.video = void 0
    }
  }

  play(timer$: Observable<number>) {
    return this.load().pipe(
      switchMap(() => {
        const video = this.video
        if (!video) {
          throw new Error('Video not loaded')
        }
        const playPromise = video.play()

        timer$
          .pipe(
            first(),
            tap((time) => {
              // VideoWall: resync if the timer is ahead of the video.
              if (time > video.currentTime * 1000) {
                this.seek(time / 1000)
              }
            })
          )
          .subscribe()

        if (playPromise) {
          playPromise.catch((err) => {
            console.error(`Video play error: ${err}`)
          })
        }

        return fromEvent(video, 'playing').pipe(
          take(1),
          switchMap(() =>
            race(
              // Dummy observable that pauses if the playing observable gets
              // unsubscribed, required for pausing the video.
              new Observable<string>((subscriber) => {
                return () => {
                  video.pause()
                }
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
        )
      })
    )
  }

  stop() {
    this.video?.pause()
  }

  seek(offset: number): Observable<[number, number]> {
    this.offset = offset
    if (this.video && this.video.readyState >= ReadyState.HAVE_METADATA) {
      this.video.currentTime = offset / 1000

      const slow$ = of([offset, 0])

      return fromEvent(this.video, 'seeked').pipe(
        take(1),
        // Timeout for slow or video tags not implementing seeked event.
        timeout({
          each: 500,
          with: () => slow$,
        }),
        map((evt) => [offset, 0])
      )
    }
    return of([offset, 0])
  }

  volume(volume: number) {
    if (this.video) {
      this._volume = this.video.volume = volume
    }
  }

  /*
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
  */

  mimeType(): string {
    return 'video/mpeg4'
  }
}
