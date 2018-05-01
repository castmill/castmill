import { PlayServer } from './play-server';

export interface Playable {
  duration(): number;
  load(): Promise<void>;
  unload(): Promise<void>;
  play(server?: PlayServer): Promise<void>;
}
