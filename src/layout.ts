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

 import{ Layer } from './layer';
 import { Container } from './container';

 export class Layout extends Layer {
  private containers: Container[] = [];
  private finished: number = 0;

  constructor(opts?: {}) {
    super(opts || {});
  }

  /**
   * Add a container to this layout.
   */
  add(css: {}) {
    var el = document.createElement("div");
    $(el).css({
      position: "absolute"
    });

    $(el).css(css);

    this.el.appendChild(el);
    var container = new Container(() => {
      if (!container.played) {
        container.played = true;
        this.finished++;
      }
      if (this.finished < this.containers.length) {
        container.replay();
      } else {
        this.containers.forEach(container => container.stop());
      }
    }, el);

    this.containers.push(container);
    return container;
  }

  duration() {
    return this.containers.reduce((prev, curr, index, arr) => {
      var duration = curr.duration();
      return prev > duration ? prev : duration;
    }, 0);
  }

  play(): Promise<any> {
    this.finished = 0;
    return Promise.all(
      this.containers.map(container => {
        return container.play();
      })
    );
  }

  stop(): Promise<any> {
    return Promise.all(
      this.containers.map(container => {
        return container.stop();
      })
    );
  }

  seek(offset: number): Promise<any> {
    return Promise.all(
      this.containers.map(container => {
        return container.seek(offset);
      })
    );
  }

  load(): Promise<void> {
    return Promise.resolve(void 0);
  }

  unload(): Promise<void> {
    return Promise.resolve(void 0);
  }
}
