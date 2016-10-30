
/// <reference path="../node_modules/@types/es6-promise/index.d.ts" />

namespace Castmill {

  export abstract class Widget {

    constructor(el: HTMLElement, opts: {}){
    }

    /**
     * Widget is ready.
     */
    abstract ready(): Promise<void>;

    /**
     * Dispose.
     */
    abstract dispose(): void;

    /**
     * Return mimetype for this widget
     */
    abstract mimeType(): string;

    /**
     *  Starts playing the content.
     *  It returns a promise that resolves when the content has played completely.
     */
    play(): Promise<void>{
      return Promise.resolve(void 0);
    }

    stop(): Promise<void>{
      return Promise.resolve(void 0);
    }

    seek(offset: number): Promise<void>{
      return Promise.resolve(void 0);
    }
    volume(level: number): void{
      return void 0;
    }
  }

}
