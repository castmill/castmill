import { Playable } from "./playable";
import { PlayServer } from "./play-server";
import { Layer } from "./layer";
import { extend } from "lodash";

export class Playlist implements Playable {
  public entries: Playable[] = [];

  private offset: number = 0;
  private onEnd: () => void;
  private playing: Promise<void> = Promise.resolve();

  constructor(onEnd: () => void, opts?: any) {
    extend(this, opts);
    this.onEnd = onEnd;
  }

  load(): Promise<void> {
    return Promise.resolve(void 0);
  }

  // TODO: Add offset support.
  play(server?: PlayServer): Promise<any> {
    return this.playing = this.playEntries(server);
  }

  private async playEntries(server?: PlayServer): Promise<any> {
    for (const entry of this.entries){
      if (entry instanceof Layer && server) {
        await server.play(entry, 0, 100, true);
      } else if (entry instanceof Playlist) {
        await entry.play(server);
      }
    }
    this.onEnd();
  }

  unload(): Promise<void> {
    return Promise.resolve();
  }

  seek(offset: number): Promise<void> {
    this.offset = offset;
    // Find entry with the current given offset.
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  show(): Promise<void> {
    return Promise.resolve();
  }

  hide(): Promise<void> {
    return Promise.resolve();
  }

  duration(): number {
    return this.entries.reduce((val, curr) => {
      return curr.duration() + val;
    }, 0);
  }

  add(entry: Playable, index?: number): void {
    if (index) {
      this.entries.splice(index, 0, entry);
    } else {
      this.entries.push(entry);
    }
  }
}
