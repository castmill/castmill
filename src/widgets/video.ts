import * as $ from "jquery";
import { Widget } from "../widgets";
import { isUndefined } from "lodash";
import { Observable, fromEvent, of } from "rxjs";

export class Video extends Widget {
  private video: HTMLVideoElement;
  private waitLoad: Promise<void>;
  private el: HTMLElement;
  private startPlaying!: Promise<void>;
  private stopping!: Promise<void>;
  private cancelPlay!: () => void;

  offset: number = 0;

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

    this.startPlaying = this.waitUntilItCanPlayThrough()
    await this.startPlaying;

    this.video.play()


    const playing = new Promise<void>((resolve, reject) => {

      const timeupdate = (event: any)  => {
        const video = <HTMLVideoElement>(event.target);
        this.offset = video.currentTime;
        this.emit('offset', this.offset);
      }

      const playingHandler = () => {
        $video.one("ended", <any>resolve);
        $video.on('timeupdate', <any>timeupdate);
      }

      $video.one("playing", playingHandler);

      this.cancelPlay = () => {
        $video.off("playing", playingHandler);
        $video.off("ended", <any>resolve);
        reject(new Error('Cancelled play'));
        delete this.startPlaying;
      }
    });

    return playing;    
  }

  async stop(): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }

    if (!this.video.paused && this.startPlaying) {
      var $video = $(this.video);

      await this.startPlaying;

      this.cancelPlay();

      await this.pause();

      delete this.stopping;
    }
  }

  private pause(): Promise<any> {
    const $video = $(this.video);

    return this.stopping = new Promise( (resolve) => {
      $video.one("pause", val => {
        resolve();
      });
      this.video.pause();
    });
  }

  async seek(offset: number){
    this.video.currentTime = offset;
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

  async volume(level: number) {
    await this.waitLoad;
    this.video.volume = level;
  }

  async duration() {
    await this.waitLoad;
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

  private async waitUntilItCanPlayThrough(): Promise<any> {
    if (this.video.readyState < 4) {
      return new Promise(resolve => {
        $(this.video).on("canplaythrough", () => resolve());
      });
    }
  }
}
