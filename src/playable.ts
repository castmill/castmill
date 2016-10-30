/// <reference path="../node_modules/@types/es6-promise/index.d.ts" />

namespace Castmill {
  export interface Playable {
    duration(): number;
    load(): Promise<void>;
    play(server?: PlayServer): Promise<void>;
    unload(): Promise<void>;
  }
}
