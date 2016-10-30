
/// <reference path="../widget.ts" />
/**
 */
namespace Castmill {
  export class Image extends Widget {
    private img: HTMLElement;
    private waitLoad: Promise<void>;

    constructor(el: HTMLElement, opts: any){
      super(el, opts);

      var dummy = document.createElement('img');
      dummy.src = opts.src;

      var img = this.img = document.createElement('div');
      img.style.background = 'url(' + opts.src + ') no-repeat center';
      img.style.backgroundSize = 'contain';
      img.style.width = '100%';
      img.style.height = '100%';

      el.appendChild(img);

      this.waitLoad = new Promise<void>(function(resolve){
        dummy.onload = function(){
          resolve();
        }
      });
    }

    ready(): Promise<void>{
      return this.waitLoad;
    }

    dispose(): void {
      this.img.style.background = 'none';
    }

    mimeType(): string{
      return 'image/jpeg';
    }
  }
}
