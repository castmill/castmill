import { Observable } from 'rxjs';
import { Renderer } from './renderer';

export enum Status {
  NotReady,
  Loading,
  Ready,
  Starting,
  Playing,
  Stopping,
  Stopped,
  Seeking,
}

export interface Playable {
  duration(): number;

  play(server: Renderer, opts?: { loop: boolean }): void;
  seek(offset: number): void;
  status: Status;

  show(offset: number): Observable<string>;
  unload(): void;
}
