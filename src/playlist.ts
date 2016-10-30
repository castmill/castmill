
/// <reference path="playable.ts" />
/// <reference path="play-server.ts" />
/// <reference path="../node_modules/@types/bluebird/index.d.ts" />

/*
declare class bluebird<T> {
  static each<R, U>(values: any[], iterator: (item: R, index: number, arrayLength: number) => U): Promise<R[]>;
}
*/
namespace Castmill {
  export class Playlist implements Playable {

    public entries: Playable[] = [];

    private offset: number;
    private onEnd: () => void;
    private playing: Promise<void>;

    constructor(onEnd: () => void, opts?: any){
      _.extend(this, opts);
      this.onEnd = onEnd;
    }

    load(): Promise<void>{
      return Promise.resolve(void 0);
    }

    play(server?: PlayServer): Promise<any>{
      return this.playing =  Bluebird.each(this.entries, (entry: Playable) => {
        if(entry instanceof Layer){
          return server.play(entry, 0, 100, true);
        } else if(entry instanceof Playlist){
          return entry.play(server);
        }
      }).then(() => {
        setTimeout(() => {
          this.onEnd();
        }, 0);
      })
    }

    unload(): Promise<void>{
      return Promise.resolve(void 0);
    }

    seek(offset: number): Promise<void>{
      this.offset = offset;
      // Find entry with the current given offset.
      return Promise.resolve(void 0);
    }

    stop(): Promise<void>{
      return Promise.resolve(void 0);
    }

    show(): Promise<void>{
      return Promise.resolve(void 0);
    }

    hide(): Promise<void>{
      return Promise.resolve(void 0);
    }

    duration(): number {
      return this.entries.reduce((val, curr,) => {
        return curr.duration() + val;
      }, 0);
    }

    add(entry: Playable, index?:number): void {
      if(index){
        this.entries.splice(index, 0, entry);
      }else{
        this.entries.push(entry);
      }
    }
  }
}
