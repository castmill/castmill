
/// <reference path="../../node_modules/@types/jquery/index.d.ts" />
/// <reference path="../widget.ts" />
namespace Castmill {
  export class Video extends Widget {
    private video: HTMLVideoElement;
    private waitLoad: Promise<void>;
    private el: HTMLElement;
    private startPlaying: Promise<void>;
    private pausing: Promise<void>;

    constructor(el: HTMLElement, opts: any){
      super(el, opts);

      this.el = el;

      var video = this.video = document.createElement('video');
      video.style.width = "100%";
      video.style.height = "100%";

      video.src = opts.src;
      el.appendChild(video);

      var $video = $(this.video);
      this.waitLoad = new Promise<void>(function(resolve){
        $video.one('loadedmetadata', () => resolve());
      });
    }

    play(): Promise<void>{
      var $video = $(this.video);
      this.startPlaying = this.waitUntilItCanPlayThrough().then(() => this.video.play())

      return new Promise<void>(function (resolve) {
        $video.one('playing', function () {
          $video.one('ended', () => resolve());
        });
      });
    }

    stop(): Promise<void>{
      if(this.pausing){
        return this.pausing;
      }

      if(this.video.paused){
        return Promise.resolve(void 0);
      }

      var $video = $(this.video);
      this.startPlaying = this.startPlaying || Promise.resolve(void 0);
      return this.pausing = new Promise<void>((resolve) => {
        this.startPlaying.then(() => {
          $video.one('pause', (val) => {
            this.pausing = null;
            resolve();
          });
          this.video.pause();
        });
      });
    }

    seek(offset: number, isBrowser?: boolean): Promise<void>{
      var _resolve: any, _reject: any;
      var $video = $(this.video);

      var seekErrorHandler = function(){
        _reject(Error('Seek error...'));
      }

      return (new Promise((resolve, reject) => {
        _resolve = resolve;
        _reject = reject;

        if(this.video.currentTime === offset){
          return resolve();
        }

        // ugly but we have to resolve even when the seeked event is never emitted
        if(!isBrowser){
          resolve();
        } else {
          $video.one('seeked', _resolve);
          $video.one('error', seekErrorHandler);
        }
        (this.pausing || Promise.resolve(void 0)).then(() => {
          this.video.currentTime = offset;
        });
      })).finally(function(){
        $video.off('seeked', _resolve);
        $video.off('error', seekErrorHandler);
      });
    }

    volume(level: number): void {
      this.video.volume = level;
    }

    duration(){
      return this.video.duration;
    }

    ready(): Promise<void>{
      return this.waitLoad;
    }

    dispose(): void {
      this.video.src = '';
    }

    mimeType(): string{
      return 'image/jpeg';
    }

    private waitUntilItCanPlayThrough(){
      if(this.video.readyState >= 4){
        return Promise.resolve();
      }else{
        return new Promise((resolve) => {
          $(this.video).on('canplaythrough', resolve);
        });
      }
    }
  }
}
