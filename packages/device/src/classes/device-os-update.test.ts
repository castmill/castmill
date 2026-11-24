import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CacheBackend, StorageIntegration } from '@castmill/cache';
import type { Machine, OsUpdateTarget } from '../interfaces/machine';
import { Device } from './device';

const create = (machine: Partial<Machine>) =>
  new Device(machine as Machine, {} as StorageIntegration, {
    cacheBackend: {} as CacheBackend,
  });

type WithSetOsUpdate = { setOsUpdate(target: OsUpdateTarget): void };

const target = (version: string): OsUpdateTarget => ({
  version,
  url: `https://example.com/${version}.raucb`,
});

describe('Device OS update target', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a rejected target with backoff until the bridge accepts it', async () => {
    vi.useFakeTimers();
    const setOsUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error('agent restarting'))
      .mockRejectedValueOnce(new Error('agent restarting'))
      .mockResolvedValue(undefined);
    const device = create({ setOsUpdate });

    (device as unknown as WithSetOsUpdate).setOsUpdate(target('0.3.0'));
    await vi.advanceTimersByTimeAsync(0);
    expect(setOsUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(setOsUpdate).toHaveBeenCalledTimes(2);

    // Second retry after twice the delay.
    await vi.advanceTimersByTimeAsync(9_999);
    expect(setOsUpdate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(setOsUpdate).toHaveBeenCalledTimes(3);

    // Accepted: no more retries.
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(setOsUpdate).toHaveBeenCalledTimes(3);
  });

  it('drops a pending retry when a newer target arrives', async () => {
    vi.useFakeTimers();
    const setOsUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error('agent restarting'))
      .mockResolvedValue(undefined);
    const device = create({ setOsUpdate });
    const set = (device as unknown as WithSetOsUpdate).setOsUpdate.bind(device);

    set(target('0.3.0'));
    await vi.advanceTimersByTimeAsync(0);
    set(target('0.3.1'));
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(setOsUpdate.mock.calls.map(([t]) => t.version)).toEqual([
      '0.3.0',
      '0.3.1',
    ]);
  });

  it('gives up after a bounded number of attempts', async () => {
    vi.useFakeTimers();
    const setOsUpdate = vi.fn().mockRejectedValue(new Error('refused'));
    const device = create({ setOsUpdate });

    (device as unknown as WithSetOsUpdate).setOsUpdate(target('0.1.0'));
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(setOsUpdate).toHaveBeenCalledTimes(10);
  });
});
