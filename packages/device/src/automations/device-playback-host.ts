import type {
  JsonPlaylist,
  Layer,
  Player,
  PlayerGlobals,
  Playlist,
  PlaylistItemStart,
} from '@castmill/player';
import type { AbortSignalLike, PlaybackHost } from './types';

/** Maximum number of plays expanded into one interruption layer. */
const MAX_PLAYS = 100;

export interface DevicePlaybackDeps {
  player(): Player | undefined;
  queue(): Playlist | undefined;
  /** Fetches a playlist (cached for offline use) and caches its media. */
  loadPlaylist(playlistId: number | string): Promise<JsonPlaylist | void>;
  createLayer(json: JsonPlaylist, globals: PlayerGlobals): Promise<Layer>;
  playerGlobals(): PlayerGlobals;
  /** Stops the player and empties the content queue. */
  clearPlayback(): void;
  /** Queues a playlist of normal programming and starts playback. */
  enqueueProgramming(json: JsonPlaylist): Promise<void>;
  /** Wakes the programming loop so it schedules content immediately. */
  wake(): void;
}

interface ItemPosition {
  json: JsonPlaylist;
  index: number;
  count: number;
}

export function rotateItems(json: JsonPlaylist, start: number): JsonPlaylist {
  const items = json.items || [];
  const index = items.length ? start % items.length : 0;
  return {
    ...json,
    items: items.slice(index).concat(items.slice(0, index)),
  };
}

export function repeatItems(json: JsonPlaylist, plays: number): JsonPlaylist {
  const items = json.items || [];
  let repeated: JsonPlaylist['items'] = [];
  const count = Math.max(1, Math.min(MAX_PLAYS, Math.floor(plays) || 1));
  for (let i = 0; i < count; i++) repeated = repeated.concat(items);
  return { ...json, items: repeated };
}

/**
 * Runs automation interruptions on the device's single player and resumes
 * normal programming afterwards with the item after the interrupted one
 * (playlist rotation; the interrupted item is not resumed with a seek).
 */
export class DevicePlaybackHost implements PlaybackHost {
  private interruptionActive = false;
  private resume?: { json: JsonPlaylist; nextIndex: number };
  private current?: ItemPosition;
  private boundaryListeners: Array<() => void> = [];

  constructor(private readonly deps: DevicePlaybackDeps) {}

  /** True while automations own playback; programming must not queue. */
  get interrupted(): boolean {
    return this.interruptionActive;
  }

  /**
   * Player globals for a playlist of normal programming, reporting its item
   * boundaries so interruptions can wait for them and resume after them.
   */
  programmingGlobals(json: JsonPlaylist): PlayerGlobals {
    return {
      ...this.deps.playerGlobals(),
      onItemStart: (info: PlaylistItemStart) => {
        if (this.interruptionActive) return;
        if (String(info.playlistId) !== String(json.id)) return;
        this.current = { json, index: info.index, count: info.count };
        const listeners = this.boundaryListeners;
        this.boundaryListeners = [];
        listeners.forEach((listener) => listener());
      },
    };
  }

  /**
   * Programming changed (e.g. a channel or playlist update) during an
   * interruption: resume with fresh programming instead of the saved one.
   */
  invalidateResume() {
    this.resume = undefined;
    this.current = undefined;
  }

  async preparePlaylist(playlistId: number | string): Promise<JsonPlaylist> {
    const json = await this.deps.loadPlaylist(playlistId);
    if (!json) throw new Error(`Playlist ${playlistId} is not available`);
    return json;
  }

  waitForItemBoundary(
    timeoutMs: number,
    signal: AbortSignalLike
  ): Promise<void> {
    const queue = this.deps.queue();
    if (this.interruptionActive || !queue || queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const index = this.boundaryListeners.indexOf(finish);
        if (index !== -1) this.boundaryListeners.splice(index, 1);
        resolve();
      };
      const timer = setTimeout(finish, Math.max(0, timeoutMs));
      this.boundaryListeners.push(finish);
      signal.onAbort(finish);
    });
  }

  async playInterruption(
    playlist: unknown,
    plays: number,
    signal: AbortSignalLike
  ): Promise<void> {
    const json = playlist as JsonPlaylist;
    const player = this.deps.player();
    const queue = this.deps.queue();
    if (!player || !queue || !json || !(json.items || []).length) return;

    const looping = plays === Infinity;
    const layer = await this.deps.createLayer(
      looping ? json : repeatItems(json, plays),
      this.deps.playerGlobals()
    );
    if (signal.aborted) {
      layer.unload?.();
      return;
    }

    if (!this.interruptionActive) {
      this.interruptionActive = true;
      const current = this.current;
      this.resume = current
        ? { json: current.json, nextIndex: (current.index + 1) % current.count }
        : undefined;
    }

    this.deps.clearPlayback();
    queue.add(layer);
    queue.time = 0;

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        player.off('end', onEnd);
        resolve();
      };
      const onEnd = () => {
        if (!looping) finish();
      };
      player.on('end', onEnd);
      signal.onAbort(finish);
      player.play({ loop: true });
    });
  }

  resumeProgramming(): void {
    if (!this.interruptionActive) return;
    const resume = this.resume;
    this.interruptionActive = false;
    this.resume = undefined;
    this.current = undefined;
    this.deps.clearPlayback();
    if (resume && (resume.json.items || []).length) {
      void this.deps
        .enqueueProgramming(rotateItems(resume.json, resume.nextIndex))
        .catch(() => this.deps.wake());
    } else {
      this.deps.wake();
    }
  }

  /** Stops interruptions without resuming (e.g. before a reload). */
  dispose() {
    this.interruptionActive = false;
    this.resume = undefined;
    const listeners = this.boundaryListeners;
    this.boundaryListeners = [];
    listeners.forEach((listener) => listener());
  }
}
