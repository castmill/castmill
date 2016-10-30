
/// <reference path="playlist.ts" />
/// <reference path="play-server.ts" />

namespace Castmill {
  export enum Anchor {
    top = 1,
    down,
    left,
    right,
    center
  }

  /**
   * Defines a container that can hold Playable objects.
   *
   */
  export class Container extends Playlist {
    el: HTMLElement;
    server: PlayServer;

    constructor(el: HTMLElement) {
      super(() => {});

      this.el = el;
      this.server = new PlayServer(el, {});
    }

    play(server?: PlayServer): Promise<any>{
      return super.play(server || this.server);
    }
  }
}
