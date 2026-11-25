import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ItemType,
  MemoryCache,
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
    usage: vi.fn(async (type: ItemType) => {
      const ofType = items.filter((i) => i.type === type);
      return {
        items: ofType.length,
        bytes: ofType.reduce((sum, i) => sum + i.size, 0),
      };
    }),
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

  it('counts the cache correctly while it is being read (webOS memory cache)', async () => {
    // MemoryCache moves an item to the end of its map on every read, so
    // paging through list() while the player reads the cache would skip or
    // double-count items. Reads between list() pages must not matter.
    const urls = Array.from(
      { length: 150 },
      (_, i) => `https://castmill.test/medias/${i}.mp4`
    );
    const storage = {
      init: async () => {},
      listFiles: async () =>
        urls.map((url, i) => ({
          url: `http://127.0.0.1:9080/castmill-cache/${i}.mp4`,
          size: i + 1,
          sourceUrl: url,
          type: ItemType.Media,
        })),
    } as unknown as StorageIntegration;
    const cache = new MemoryCache(storage);
    await cache.init();
    const list = cache.list.bind(cache);
    vi.spyOn(cache, 'list').mockImplementation(async (...args) => {
      const page = await list(...args);
      // The player reads an item of this page before the next page is listed.
      if (page[0]) await cache.get(page[0].url);
      return page;
    });
    const device = new Device({} as Machine, {} as StorageIntegration, {
      cacheBackend: cache,
    });

    const telemetry = await device.getTelemetry();

    expect(telemetry.cache?.types.media).toEqual({
      items: 150,
      bytes: (150 * 151) / 2,
    });
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
        usage: async () => {
          throw new Error('closed');
        },
      } as unknown as CacheBackend,
    });

    const telemetry = await device.getTelemetry();

    expect(telemetry.cache).toBeUndefined();
    expect(telemetry.player).toBeDefined();
  });
});
