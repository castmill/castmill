import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ItemType,
  type CacheBackend,
  type ItemMetadata,
  type StorageIntegration,
} from '@castmill/cache';
import type { Machine } from '../interfaces/machine';
import { Device } from './device';

const item = (type: ItemType, size: number) =>
  ({ url: `${type}-${size}`, size, type }) as ItemMetadata;

const cacheBackend = (items: ItemMetadata[]) =>
  ({
    count: vi.fn(
      async (type: ItemType) => items.filter((i) => i.type === type).length
    ),
    list: vi.fn(async (type: ItemType, offset = 0, limit = 10) =>
      items.filter((i) => i.type === type).slice(offset, offset + limit)
    ),
  }) as unknown as CacheBackend;

const create = (machine: Partial<Machine>, items: ItemMetadata[] = []) =>
  new Device(machine as Machine, {} as StorageIntegration, {
    cacheBackend: cacheBackend(items),
  });

describe('Device telemetry', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds player and cache statistics to the platform telemetry', async () => {
    let monotonicNow = 0;
    vi.stubGlobal('performance', { now: () => monotonicNow });
    const device = create(
      {
        getTelemetry: async () => ({
          memory: { usedBytes: 1, totalBytes: 2 },
        }),
      },
      [
        item(ItemType.Media, 300),
        item(ItemType.Media, 200),
        item(ItemType.Data, 10),
      ]
    );
    (device as unknown as { connectedAt: number }).connectedAt = 500;
    monotonicNow = 90_500;

    const telemetry = await device.getTelemetry();

    expect(telemetry.memory).toEqual({ usedBytes: 1, totalBytes: 2 });
    expect(telemetry.player?.uptimeSeconds).toBe(90);
    expect(telemetry.player?.connectedSeconds).toBe(90);
    expect(telemetry.cache).toEqual({
      items: 3,
      bytes: 510,
      types: {
        code: { items: 0, bytes: 0 },
        data: { items: 1, bytes: 10 },
        media: { items: 2, bytes: 500 },
      },
    });
  });

  it('reads cache usage in bounded pages', async () => {
    const items = Array.from({ length: 205 }, (_, i) =>
      item(ItemType.Media, i + 1)
    );
    const cache = cacheBackend(items);
    const list = vi.spyOn(cache, 'list');
    const device = new Device({} as Machine, {} as StorageIntegration, {
      cacheBackend: cache,
    });

    const telemetry = await device.getTelemetry();

    expect(telemetry.cache?.types.media).toEqual({
      items: 205,
      bytes: items.reduce((sum, cacheItem) => sum + cacheItem.size, 0),
    });
    expect(list.mock.calls).toEqual([
      [ItemType.Media, 0, 100],
      [ItemType.Media, 100, 100],
      [ItemType.Media, 200, 100],
    ]);
  });

  it('falls back to the wall clock when performance.now is unavailable', async () => {
    vi.useFakeTimers({ now: 0 });
    vi.stubGlobal('performance', undefined);
    const device = create({});
    vi.setSystemTime(90_500);

    const telemetry = await device.getTelemetry();

    expect(telemetry.player?.uptimeSeconds).toBe(90);
  });

  it('reports the JavaScript heap when the runtime exposes it', async () => {
    vi.stubGlobal('performance', {
      now: () => 0,
      memory: { usedJSHeapSize: 50, jsHeapSizeLimit: 200 },
    });
    const telemetry = await create({}).getTelemetry();

    expect(telemetry.player?.heap).toEqual({ usedBytes: 50, limitBytes: 200 });
  });

  it('omits the heap when the runtime does not expose it', async () => {
    vi.stubGlobal('performance', { now: () => 0 });
    const telemetry = await create({}).getTelemetry();

    expect(telemetry.player?.heap).toBeUndefined();
  });

  it('still reports player statistics when the platform reading fails', async () => {
    const telemetry = await create({
      getTelemetry: async () => {
        throw new Error('unavailable');
      },
    }).getTelemetry();

    expect(telemetry.player?.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(telemetry.cache?.items).toBe(0);
  });

  it('omits cache statistics when the cache cannot be read', async () => {
    const device = new Device({} as Machine, {} as StorageIntegration, {
      cacheBackend: {
        count: async () => {
          throw new Error('closed');
        },
      } as unknown as CacheBackend,
    });

    const telemetry = await device.getTelemetry();

    expect(telemetry.cache).toBeUndefined();
    expect(telemetry.player).toBeDefined();
  });
});
