/**
 *
 * A Layout defines areas in the screen where content can be played.
 * A layout can be as simple as one full screen, or it can be composed
 * of dozens of different areas, overlapping or not.
 * Every layout area has a play-server that plays content independently of the
 * other areas.
 *
 *  A Layout is playable as well, so a layout can be part of other layouts, used in
 *  playlists as any other layer.
 */
/// <reference path="layer.ts" />
/// <reference path="container.ts" />

namespace Castmill {

  export class Layout extends Layer {
    private containers: Container[] = [];

    constructor(opts: {}){
      super(opts);
    }

    /**
     * Add a container to this layout.
     */
    add(css: {}){
      var el =  document.createElement('div');
      $(el).css({
        position: 'absolute'
      });

      $(el).css(css);

      this.el.appendChild(el);
      var container = new Container(el);
      this.containers.push(container);
      return container;
    }

    duration(){
      return this.containers.reduce((prev, curr, index, arr) => {
        var duration = curr.duration();
        return prev > duration ? prev : duration;
      }, 0);
    }

    play(): Promise<any>{
      return Promise.all(this.containers.map((container) => {
        return container.play();
      }));
    }

    stop(): Promise<any>{
      return Promise.all(this.containers.map((container) => {
        return container.stop();
      }));
    }

    seek(offset: number): Promise<any>{
      return Promise.all(this.containers.map((container) => {
        return container.seek(offset);
      }));
    }

    load(): Promise<void>{
      return Promise.resolve(void 0);
    }

    unload(): Promise<void>{
      return Promise.resolve(void 0);
    }
  }

}
