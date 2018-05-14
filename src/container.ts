import { Playlist } from "./playlist";
import { PlayServer } from "./play-server";

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
  protected el: HTMLElement;
  
  played: boolean = false;

  constructor(onEnd: () => void, el: HTMLElement) {
    super(onEnd);

    this.el = el;
    this.server = new PlayServer(el, {});
  }

  play(server?: PlayServer): Promise<any> {
    this.played = false;
    return super.play(server || this.server);
  }

  replay(server?: PlayServer): Promise<any> {
    return super.play(server || this.server);
  }
}
