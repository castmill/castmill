import { Playable, Status } from "./playable";
import { PlayServer } from "./play-server";
import { Layer } from "./layer";
import { extend } from "lodash";
import { EventEmitter } from 'eventemitter3';

export class Playlist extends EventEmitter implements Playable {
  public entries: Playable[] = [];

  // TODO: rename offset to time
  offset: number = 0;
  protected playing: Promise<void> = Promise.resolve();
  protected server!: PlayServer;

  status: Status = Status.NotReady;

  constructor(opts?: any) {
    super();
    extend(this, opts);
  }

  load(): Promise<void> {
    return Promise.resolve(void 0);
  }

  play(server: PlayServer): Promise<any> {
    return (this.playing = this.playEntries(server));
  }

  private async playEntries(server: PlayServer) {
    let offset = this.offset;
    let prevEntry!: any;
    this.server = server;

    const offsetListener = (newOffset: number) => {
      this.offset = offset + newOffset;
      this.emit("offset", this.offset);
    };

    try {
      const result = await this.findEntry(this.offset);
      if (result) {
        const entry = prevEntry = this.entries[result.index];
        prevEntry.on("offset", offsetListener);

        await entry.seek(this.offset - result.offset);
        await this.playEntry(server, entry);        

        for (let i = result.index + 1; i < this.entries.length; i++) {
          const entry = this.entries[i];
          prevEntry.removeListener("offset", offsetListener);

          prevEntry = entry;
          prevEntry.on("offset", offsetListener);

          await this.playEntry(server, entry);

          const duration = await entry.duration();
          offset += duration;
        }
      }
    } catch (err) {}
    finally{
      prevEntry.removeListener("offset", offsetListener);
    }

    this.emit("end");
  }

  private async playEntry(server: PlayServer, entry: Playable) {
    if (entry instanceof Layer && server) {
      await server.play(entry, 0, 100, true);
    } else if (entry instanceof Playlist) {
      await entry.play(server);
    }
  }

  unload(): Promise<void> {
    return Promise.resolve();
  }

  async seek(offset: number): Promise<void> {
    this.offset = offset;
    const result = await this.findEntry(offset);

    if (result) {
      const entry = this.entries[result.index];
      return entry.seek(offset - result.offset);
    }
  }

  private async findEntry(offset: number) {
    let currOffset = 0;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const duration = await entry.duration();
      if (currOffset + duration > offset) {
        return { index: i, offset: currOffset, duration: duration };
      }
      currOffset += duration;
    }
    return null;
  }

  async stop(): Promise<void> {
    this.server.stop();
  }

  async show(server?: PlayServer): Promise<void> {
    for (const entry of this.entries) {
      if (entry instanceof Layer && server) {
        await server.show(entry, 0, false);
      } else if (entry instanceof Playlist) {
        await entry.show(server);
      }
    }
  }

  async hide(): Promise<void> {}

  async duration(): Promise<number> {
    var totalDuration = 0;

    await Promise.all(
      this.entries.map(async entry => {
        const duration = await entry.duration();
        totalDuration += duration;
      })
    );

    return totalDuration;
  }

  public get position(): number {
    return this.offset;
  }

  add(entry: Playable, index?: number): void {
    if (index) {
      this.entries.splice(index, 0, entry);
    } else {
      this.entries.push(entry);
    }
  }
}
