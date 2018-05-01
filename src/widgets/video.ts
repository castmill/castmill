import * as $ from "jquery";
import { Widget } from "../widget";
import { isUndefined } from "lodash";
//import * as Bluebird from "bluebird";

export class Video extends Widget {
  private video: HTMLVideoElement;
  private waitLoad: Promise<void>;
  private el: HTMLElement;
  private startPlaying: Promise<void> = Promise.resolve();
  private pausing: Promise<void> = Promise.resolve();

  constructor(el: HTMLElement, opts: any) {
    super(el, opts);

    this.el = el;

    var video = (this.video = document.createElement("video"));
    video.style.width = "100%";
    video.style.height = "100%";

    video.src = opts.src;
    el.appendChild(video);

    var $video = $(this.video);
    this.waitLoad = new Promise<void>(function(resolve) {
      $video.one("loadedmetadata", <any>resolve);
    });

    !isUndefined(opts.volume) && this.volume(opts.volume);
  }

  async play() {
    var $video = $(this.video);
    this.startPlaying = this.waitUntilItCanPlayThrough().then(() =>
      this.video.play()
    );

    return new Promise<void>(function(resolve, reject/*, onCancel*/) {
      var playingHandler = () => $video.one("ended", <any>resolve);

      $video.one("playing", playingHandler);
/*
      onCancel &&
        onCancel(function() {
          $video.off("playing", playingHandler);
          $video.off("ended", <any>resolve);
        });
        */
    });
  }

  stop(): Promise<void> {
    if (this.pausing) {
      return this.pausing;
    }

    if (this.video.paused) {
      return Promise.resolve(void 0);
    }

    var $video = $(this.video);
    this.startPlaying = this.startPlaying || Promise.resolve(void 0);
    return (this.pausing = new Promise<void>(resolve => {
      this.startPlaying.then(() => {
        $video.one("pause", val => {
          this.pausing = Promise.resolve();
          resolve();
        });
        this.video.pause();
      });
    }));
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

  volume(level: number): void {
    this.video.volume = level;
  }

  duration() {
    return this.video.duration;
  }

  ready(): Promise<void> {
    return this.waitLoad;
  }

  dispose(): void {
    this.video.src = "";
  }

  mimeType(): string {
    return "image/jpeg";
  }

  private waitUntilItCanPlayThrough(): Promise<void> {
    if (this.video.readyState >= 4) {
      return Promise.resolve(void 0);
    } else {
      return new Promise(resolve => {
        $(this.video).on("canplaythrough", () => resolve(void 0));
      });
    }
  }
}
