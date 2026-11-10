import { afterEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import { Player, Playlist } from '@castmill/player';
import type { JsonPlaylist, Layer, Renderer } from '@castmill/player';
import { DevicePlaybackHost } from './device-playback-host';
import { AbortFlag } from './types';

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('DevicePlaybackHost with Player', () => {
  afterEach(() => vi.useRealTimers());

  it('finishes finite playback after blocked time and a resolved duration', async () => {
    vi.useFakeTimers();
    let duration = 1000;
    const blocked = new BehaviorSubject<{ code: string } | undefined>({
      code: 'not-ready',
    });
    const layer = {
      name: 'interruption',
      debugInfo: {},
      duration: () => duration,
      seek: (offset: number) => of([offset, duration]),
      blocked$: () => blocked,
      reportError: vi.fn(),
    } as unknown as Layer;
    const queue = new Playlist('device', {} as never);
    queue.add({
      ...layer,
      name: 'programming',
      duration: () => 10_000,
      seek: (offset: number) => of([offset, 10_000]),
      blocked$: () => of(undefined),
    } as unknown as Layer);
    const renderer = {
      play: (_layer: Layer, timer: any) =>
        _layer.blocked$().pipe(
          filter((value) => !value),
          take(1),
          switchMap(() => timer)
        ),
    } as unknown as Renderer;
    const player = new Player(queue, renderer);
    const host = new DevicePlaybackHost({
      player: () => player,
      queue: () => queue,
      loadPlaylist: async () => undefined,
      createLayer: async () => layer,
      playerGlobals: () => ({ target: 'poster' }),
      clearPlayback: () => {
        player.stop();
        queue.layers = [];
        queue.time = 0;
      },
      enqueueProgramming: async () => undefined,
      wake: () => {},
    });

    let finished = false;
    const done = host
      .playInterruption(
        { id: 5, name: 'interruption', items: [{}] } as JsonPlaylist,
        1,
        new AbortFlag()
      )
      .then(() => {
        finished = true;
      });
    await settle();

    await vi.advanceTimersByTimeAsync(500);
    duration = 2000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(finished).toBe(false);

    blocked.next(undefined);
    await vi.advanceTimersByTimeAsync(1900);
    expect(finished).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(finished).toBe(true);
  });
});
