import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { JsonPlaylist, Layer, PlayerGlobals } from '@castmill/player';
import {
  DevicePlaybackHost,
  repeatItems,
  rotateItems,
} from './device-playback-host';
import { AbortFlag } from './types';

const playlist = (id: number, count: number): JsonPlaylist =>
  ({
    id,
    name: `p${id}`,
    status: 'live',
    items: Array.from({ length: count }, (_, i) => ({ id: i + 1 })),
  }) as unknown as JsonPlaylist;

const itemIds = (json: JsonPlaylist) => json.items.map((item) => item.id);

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

class FakePlayer extends EventEmitter {
  play = vi.fn();
}

const setup = () => {
  const player = new FakePlayer();
  const queue = { length: 1, time: 5, add: vi.fn() };
  const layers: Array<{ json: JsonPlaylist; unload: () => void }> = [];
  const deps = {
    player: () => player as never,
    queue: () => queue as never,
    loadPlaylist: vi.fn(async (id: number | string) =>
      id === 404 ? undefined : playlist(Number(id), 2)
    ),
    createLayer: vi.fn(async (json: JsonPlaylist, _globals: PlayerGlobals) => {
      const layer = { json, unload: vi.fn() };
      layers.push(layer);
      return layer as unknown as Layer;
    }),
    playerGlobals: () => ({ target: 'poster' as const }),
    clearPlayback: vi.fn(),
    enqueueProgramming: vi.fn(async (_json: JsonPlaylist) => undefined),
    wake: vi.fn(),
  };
  const host = new DevicePlaybackHost(deps);
  return { host, deps, player, queue, layers };
};

describe('playlist helpers', () => {
  it('rotates items to start at an index', () => {
    expect(itemIds(rotateItems(playlist(1, 4), 2))).toEqual([3, 4, 1, 2]);
    expect(itemIds(rotateItems(playlist(1, 4), 5))).toEqual([2, 3, 4, 1]);
    expect(itemIds(rotateItems(playlist(1, 0), 2))).toEqual([]);
  });

  it('repeats items for plays, within bounds', () => {
    expect(itemIds(repeatItems(playlist(1, 2), 2))).toEqual([1, 2, 1, 2]);
    expect(repeatItems(playlist(1, 1), 1000).items).toHaveLength(100);
    expect(repeatItems(playlist(1, 1), 0).items).toHaveLength(1);
  });
});

describe('DevicePlaybackHost', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prepares playlists and fails when they are unavailable', async () => {
    const { host } = setup();
    await expect(host.preparePlaylist(3)).resolves.toMatchObject({ id: 3 });
    await expect(host.preparePlaylist(404)).rejects.toThrow('not available');
  });

  it('plays an interruption `plays` times and resumes after the interrupted item', async () => {
    const { host, deps, player, queue, layers } = setup();
    const channel = playlist(10, 3);
    const globals = host.programmingGlobals(channel);
    globals.onItemStart!({ playlistId: 10, index: 1, count: 3 });
    // Items of nested playlists are ignored.
    globals.onItemStart!({ playlistId: 99, index: 0, count: 1 });

    const done = host.playInterruption(playlist(5, 2), 2, new AbortFlag());
    await settle();
    expect(host.interrupted).toBe(true);
    expect(itemIds(layers[0].json)).toEqual([1, 2, 1, 2]);
    expect(deps.clearPlayback).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(layers[0]);
    expect(queue.time).toBe(0);
    expect(player.play).toHaveBeenCalledWith({ loop: false });

    // Programming boundaries during the interruption do not move the resume point.
    globals.onItemStart!({ playlistId: 10, index: 2, count: 3 });
    player.emit('completed');
    await done;

    host.resumeProgramming();
    expect(host.interrupted).toBe(false);
    expect(deps.enqueueProgramming).toHaveBeenCalledTimes(1);
    expect(itemIds(deps.enqueueProgramming.mock.calls[0][0])).toEqual([
      3, 1, 2,
    ]);
    // Resuming twice is a no-op.
    host.resumeProgramming();
    expect(deps.enqueueProgramming).toHaveBeenCalledTimes(1);
  });

  it('wakes programming when there is nothing to resume', async () => {
    const { host, deps, player } = setup();
    const done = host.playInterruption(playlist(5, 1), 1, new AbortFlag());
    await settle();
    player.emit('completed');
    await done;
    host.resumeProgramming();
    expect(deps.enqueueProgramming).not.toHaveBeenCalled();
    expect(deps.wake).toHaveBeenCalled();
  });

  it('wakes programming when resuming fails', async () => {
    const { host, deps, player } = setup();
    deps.enqueueProgramming.mockRejectedValueOnce(new Error('offline'));
    host.programmingGlobals(playlist(10, 2)).onItemStart!({
      playlistId: 10,
      index: 0,
      count: 2,
    });
    const done = host.playInterruption(playlist(5, 1), 1, new AbortFlag());
    await settle();
    player.emit('completed');
    await done;
    host.resumeProgramming();
    await settle();
    expect(deps.wake).toHaveBeenCalled();
  });

  it('loops state interruptions until aborted', async () => {
    const { host, player, layers } = setup();
    const signal = new AbortFlag();
    let finished = false;
    const done = host
      .playInterruption(playlist(5, 2), Infinity, signal)
      .then(() => (finished = true));
    await settle();
    expect(itemIds(layers[0].json)).toEqual([1, 2]);
    player.emit('completed');
    await Promise.resolve();
    expect(finished).toBe(false);
    signal.abort();
    await done;
    expect(finished).toBe(true);
  });

  it('keeps the first resume point across consecutive interruptions', async () => {
    const { host, deps, player } = setup();
    host.programmingGlobals(playlist(10, 3)).onItemStart!({
      playlistId: 10,
      index: 0,
      count: 3,
    });
    for (const id of [5, 6]) {
      const done = host.playInterruption(playlist(id, 1), 1, new AbortFlag());
      await settle();
      player.emit('completed');
      await done;
    }
    host.resumeProgramming();
    expect(itemIds(deps.enqueueProgramming.mock.calls[0][0])).toEqual([
      2, 3, 1,
    ]);
  });

  it('resumes with fresh programming when it changed during the interruption', async () => {
    const { host, deps, player } = setup();
    host.programmingGlobals(playlist(10, 3)).onItemStart!({
      playlistId: 10,
      index: 0,
      count: 3,
    });
    const done = host.playInterruption(playlist(5, 1), 1, new AbortFlag());
    await settle();
    host.invalidateResume();
    player.emit('completed');
    await done;
    host.resumeProgramming();
    expect(deps.enqueueProgramming).not.toHaveBeenCalled();
    expect(deps.wake).toHaveBeenCalled();
  });

  it('skips empty playlists, missing players and aborted preparations', async () => {
    const { host, deps, layers } = setup();
    await host.playInterruption(playlist(5, 0), 1, new AbortFlag());
    expect(deps.createLayer).not.toHaveBeenCalled();

    const aborted = new AbortFlag();
    aborted.abort();
    await host.playInterruption(playlist(5, 1), 1, aborted);
    expect(layers[0].unload).toHaveBeenCalled();
    expect(host.interrupted).toBe(false);

    const empty = new DevicePlaybackHost({
      ...deps,
      player: () => undefined,
    });
    await empty.playInterruption(playlist(5, 1), 1, new AbortFlag());
    expect(deps.createLayer).toHaveBeenCalledTimes(1);
  });

  it('waits for the next item boundary of programming', async () => {
    const { host } = setup();
    const globals = host.programmingGlobals(playlist(10, 3));
    let waited = false;
    const wait = host
      .waitForItemBoundary(30000, new AbortFlag())
      .then((atBoundary) => {
        waited = true;
        return atBoundary;
      });
    await Promise.resolve();
    expect(waited).toBe(false);
    globals.onItemStart!({ playlistId: 10, index: 1, count: 3 });
    await expect(wait).resolves.toBe(true);
    expect(waited).toBe(true);
  });

  it('stops waiting after the maximum wait or when aborted', async () => {
    const { host } = setup();
    const timeout = host.waitForItemBoundary(1000, new AbortFlag());
    vi.advanceTimersByTime(1000);
    await expect(timeout).resolves.toBe(false);

    const signal = new AbortFlag();
    const aborted = host.waitForItemBoundary(1000, signal);
    signal.abort();
    await expect(aborted).resolves.toBe(false);

    const disposed = host.waitForItemBoundary(1000, new AbortFlag());
    host.dispose();
    await disposed;
  });

  it('does not wait when nothing is playing', async () => {
    const { host, queue } = setup();
    queue.length = 0;
    await host.waitForItemBoundary(1000, new AbortFlag());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resumes with the item that started at the boundary', async () => {
    const { host, deps, player } = setup();
    const channel = playlist(10, 3);
    const globals = host.programmingGlobals(channel);
    globals.onItemStart!({ playlistId: 10, index: 0, count: 3 });

    const boundary = host.waitForItemBoundary(30000, new AbortFlag());
    globals.onItemStart!({ playlistId: 10, index: 1, count: 3 });
    await expect(boundary).resolves.toBe(true);

    const done = host.playInterruption(
      playlist(5, 1),
      1,
      new AbortFlag(),
      true
    );
    await settle();
    player.emit('completed');
    await done;
    host.resumeProgramming();

    expect(itemIds(deps.enqueueProgramming.mock.calls[0][0])).toEqual([
      2, 3, 1,
    ]);
  });

  it('keeps next-item resume behavior when the boundary wait times out', async () => {
    const { host, deps, player } = setup();
    const channel = playlist(10, 3);
    host.programmingGlobals(channel).onItemStart!({
      playlistId: 10,
      index: 0,
      count: 3,
    });

    const boundary = host.waitForItemBoundary(1000, new AbortFlag());
    vi.advanceTimersByTime(1000);
    await expect(boundary).resolves.toBe(false);

    const done = host.playInterruption(
      playlist(5, 1),
      1,
      new AbortFlag(),
      false
    );
    await settle();
    player.emit('completed');
    await done;
    host.resumeProgramming();

    expect(itemIds(deps.enqueueProgramming.mock.calls[0][0])).toEqual([
      2, 3, 1,
    ]);
  });

  it('does not finish finite interruptions on the player timer end event', async () => {
    const { host, player } = setup();
    let finished = false;
    const done = host
      .playInterruption(playlist(5, 1), 1, new AbortFlag())
      .then(() => (finished = true));
    await settle();

    player.emit('end');
    await settle();
    expect(finished).toBe(false);

    player.emit('completed');
    await done;
    expect(finished).toBe(true);
  });

  it('clears interruption playback when disposed', async () => {
    const { host, deps, player } = setup();
    const signal = new AbortFlag();
    const done = host.playInterruption(playlist(5, 1), 1, signal);
    await settle();
    expect(deps.clearPlayback).toHaveBeenCalledTimes(1);

    signal.abort();
    host.dispose();
    await done;

    expect(deps.clearPlayback).toHaveBeenCalledTimes(2);
    expect(host.interrupted).toBe(false);
  });
});
