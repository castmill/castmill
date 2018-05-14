import { PlayServer } from "./play-server";

export enum Status {
  NotReady,
  Loading,
  Ready,
  Starting,
  Playing,
  Stopping,
  Stopped,
  Seeking
}

export interface Playable {
  duration(): Promise<number>;
  load(): Promise<void>;
  unload(): Promise<void>;
  play(server?: PlayServer): Promise<void>;
  stop(): Promise<void>;
  seek(offset: number): Promise<void>;
  status: Status;
}
