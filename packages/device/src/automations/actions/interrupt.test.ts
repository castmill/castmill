import { describe, expect, it, vi } from 'vitest';
import { InterruptAction, parseInterruptConfig } from './interrupt';
import { AbortFlag, defaultScheduler, type ActionContext } from '../types';

const host = () => ({
  preparePlaylist: vi.fn(async (id: number | string) => ({ id, items: [] })),
  waitForItemBoundary: vi.fn(async () => undefined),
  playInterruption: vi.fn(async () => undefined),
  resumeProgramming: vi.fn(),
});

const context = (
  playback: ReturnType<typeof host>,
  kind: 'event' | 'state' = 'event',
  signal = new AbortFlag()
): ActionContext => ({
  rule: {} as never,
  automation: {} as never,
  kind,
  host: playback,
  scheduler: defaultScheduler,
  signal,
});

describe('parseInterruptConfig', () => {
  it('applies the documented defaults', () => {
    expect(parseInterruptConfig({ playlist_id: 12 })).toEqual({
      playlistId: 12,
      start: 'immediately',
      maxWaitMs: 120000,
      plays: 1,
      priority: 'normal',
    });
  });

  it('reads every option', () => {
    expect(
      parseInterruptConfig({
        playlist_id: '7',
        start: 'after_current_item',
        max_wait_seconds: '30',
        plays: 3,
        priority: 'high',
      })
    ).toEqual({
      playlistId: '7',
      start: 'after_current_item',
      maxWaitMs: 30000,
      plays: 3,
      priority: 'high',
    });
  });

  it('rejects a missing playlist and falls back on invalid numbers', () => {
    expect(parseInterruptConfig({})).toBeUndefined();
    expect(parseInterruptConfig({ playlist_id: '' })).toBeUndefined();
    expect(
      parseInterruptConfig({ playlist_id: 1, plays: 0, max_wait_seconds: -1 })
    ).toMatchObject({ plays: 1, maxWaitMs: 120000 });
  });
});

describe('InterruptAction', () => {
  const action = new InterruptAction();

  it('uses playback and exposes priority and maximum wait', () => {
    expect(action.usesPlayback).toBe(true);
    expect(action.priority({ playlist_id: 1, priority: 'high' })).toBe('high');
    expect(action.priority({})).toBe('normal');
    expect(action.maxWaitMs({ playlist_id: 1, max_wait_seconds: 5 })).toBe(
      5000
    );
    expect(action.maxWaitMs({})).toBe(120000);
  });

  it('preloads the playlist', async () => {
    const playback = host();
    await action.preload({ playlist_id: 4 }, playback);
    await action.preload({}, playback);
    expect(playback.preparePlaylist).toHaveBeenCalledTimes(1);
  });

  it('plays the playlist immediately, `plays` times', async () => {
    const playback = host();
    await action.run({ playlist_id: 4, plays: 2 }, context(playback));
    expect(playback.waitForItemBoundary).not.toHaveBeenCalled();
    expect(playback.playInterruption).toHaveBeenCalledWith(
      { id: 4, items: [] },
      2,
      expect.any(AbortFlag)
    );
  });

  it('waits for the current item, up to the maximum wait', async () => {
    const playback = host();
    await action.run(
      { playlist_id: 4, start: 'after_current_item', max_wait_seconds: 30 },
      context(playback)
    );
    expect(playback.waitForItemBoundary).toHaveBeenCalledWith(
      30000,
      expect.any(AbortFlag)
    );
    expect(playback.playInterruption).toHaveBeenCalled();
  });

  it('loops while a state condition is active', async () => {
    const playback = host();
    await action.run({ playlist_id: 4, plays: 2 }, context(playback, 'state'));
    expect(playback.playInterruption.mock.calls[0][1]).toBe(Infinity);
  });

  it('does not play once aborted', async () => {
    const playback = host();
    const signal = new AbortFlag();
    playback.preparePlaylist.mockImplementation(async (id) => {
      signal.abort();
      return { id, items: [] };
    });
    await action.run({ playlist_id: 4 }, context(playback, 'event', signal));
    expect(playback.playInterruption).not.toHaveBeenCalled();

    const waiting = host();
    const aborted = new AbortFlag();
    waiting.waitForItemBoundary.mockImplementation(async () => aborted.abort());
    await action.run(
      { playlist_id: 4, start: 'after_current_item' },
      context(waiting, 'event', aborted)
    );
    expect(waiting.playInterruption).not.toHaveBeenCalled();
  });

  it('rejects an invalid configuration', async () => {
    await expect(action.run({}, context(host()))).rejects.toThrow(
      'Invalid interrupt configuration'
    );
  });
});

describe('AbortFlag', () => {
  it('notifies listeners once, also those added after the abort', () => {
    const flag = new AbortFlag();
    const listener = vi.fn();
    flag.onAbort(() => {
      throw new Error('ignored');
    });
    flag.onAbort(listener);
    flag.abort();
    flag.abort();
    expect(listener).toHaveBeenCalledTimes(1);
    const late = vi.fn();
    flag.onAbort(late);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
