import { Widget } from "./widget";
import { fromEvent, merge, Observable, of } from "rxjs";
import { map, take, tap } from "rxjs/operators";

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
    if (this.video) {
      // Not completely correct since we may not yet be "playthrough" ready
      return of("loaded");
    }
    const video = (this.video = document.createElement(
      "video"
    ) as HTMLVideoElement);
    video.style.width = "100%";
    video.style.height = "100%";

    this.offset = offset;

    video.src = this.src;
    el.appendChild(video);

    if (typeof this._volume !== "undefined") {
      this.volume(this._volume);
    }

    if (video.readyState < 4) {
      return fromEvent(video, "canplaythrough").pipe(
        map((evt) => "loaded"),
        take(1),
        tap(() => {
          video.currentTime = this.offset / 1000;
        })
      );
    } else {
      return of("loaded");
    }
  }

  unload(): void {
    console.log("going to dispose");
    if (this.video) {
      // this.video.src = "";
      this.video.parentElement?.removeChild(this.video);
      this.video = void 0;
    }
  }

  play(timer$: Observable<number>) {
    if (this.video) {
      const video = this.video;
      video.play();

      return merge(
        new Observable<string>((subscriber) => {
          // Probably we do not need this event listener at all.
          const handler = (ev: Event) => {
            subscriber.next("played");
            subscriber.complete();
          };

          video.addEventListener("ended", handler);

          return () => {
            video.removeEventListener("ended", handler);
            video.pause();
          };
        }),
        super.play(timer$)
      );
    }
    return super.play(timer$);
  }

  stop() {
    this.video?.pause();
  }

  private pause() {
    /*
    const video = this.video;

    return (this.stopping = new Promise((resolve) => {
      video.addEventListener("pause", (val) => {
        resolve();
      });
      this.video.pause();
    }));
    */
  }

  // TODO: Implement seek as an observable
  seek(offset: number): Observable<[number, number]> {
    this.offset = offset;
    if (this.video /*&& this.video.readyState > 4*/) {
      this.video.currentTime = offset / 1000;
    }
    return of([offset, 0]);
  }

  /*
  // Try to rewite this code using RxJs
  seek(offset: number, isBrowser?: boolean) {
    var _resolve: any, _reject: any;
    var $video = $(this.video);

    var seekErrorHandler = function() {
      _reject(new Error("Seek error..."));
    };

    return new Promise((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;

      if (this.video.currentTime === offset) {
        return resolve();
      }

      // ugly but we have to resolve even when the seeked event is never emitted
      if (!isBrowser) {
        resolve();
      } else {
        $video.one("seeked", _resolve);
        $video.one("error", seekErrorHandler);
      }
      (this.pausing || Promise.resolve(void 0)).then(() => {
        this.video.currentTime = offset;
      });
    }).finally(function() {
      $video.off("seeked", _resolve);
      $video.off("error", seekErrorHandler);
    });
  }
  */

  volume(volume: number) {
    if (this.video) {
      this._volume = this.video.volume = volume;
    }
  }

  duration(): Observable<number> {
    if (this._duration) {
      return of(this._duration);
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = this.src;

    return new Observable<number>((subscriber) => {
      const handler = (ev: Event) => {
        this._duration = video.duration * 1000;
        subscriber.next(this._duration);
        subscriber.complete();
      };

      video.onloadedmetadata = handler;

      return () => {
        video.onloadedmetadata = null;
      };
    });
  }

  mimeType(): string {
    return "video/mpeg4";
  }

  /*
  private async waitUntilItCanPlayThrough(): Promise<void> {
    if (this.video?.readyState < 4) {
      return new Promise((resolve) => {
        // TODO: Remove listener
        this.video.addEventListener("canplaythrough", () => resolve());
      });
    }
  }
  */
}
