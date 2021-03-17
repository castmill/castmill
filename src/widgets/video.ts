import { Widget } from "../widgets";
import { isUndefined } from "lodash";
import { fromEvent, Observable, of } from "rxjs";
import { map, take } from "rxjs/operators";

export class Video extends Widget {
  private video?: HTMLVideoElement;
  private src: string;
  private _volume: number;

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

    video.currentTime = offset / 1000;

    video.src = this.src;
    el.appendChild(video);

    !isUndefined(this._volume) && this.volume(this._volume);

    if (video.readyState < 4) {
      return fromEvent(video, "canplaythrough")
        .pipe(map((evt) => "loaded"))
        .pipe(take(1));
    } else {
      return of("loaded");
    }
  }

  unload(): void {
    console.log("going to dispose");
    if (this.video) {
      this.video.src = "";
      this.video.parentElement?.removeChild(this.video);
      this.video = void 0;
    }
  }

  play(timer$: Observable<number>) {
    if (this.video) {
      const video = this.video;
      video.play();

      return new Observable<string>((subscriber) => {
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
      });
    }
    return super.play(timer$);
  }

  async stop(): Promise<void> {
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

  seek(offset: number) {
    // console.log("video seek", offset, !!this.video);
    if (this.video) {
      this.video.currentTime = offset / 1000;
    }
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

  duration() {
    if (this.video) {
      return this.video.duration;
    }
    return 0;
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
