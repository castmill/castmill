import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemType } from '../src/cache';
import { MemoryCache } from '../src/memory-cache';
import { ResourceManager } from '../src/resource-manager';
import { StorageMockup } from './storage.mockup';

describe('MemoryCache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts and caches resources without opening IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const url = 'https://castmill.test/channels';
    const storage = new StorageMockup({ [url]: '{"data":[]}' });
    const cache = new MemoryCache(storage);

    await cache.init();
    const item = await cache.set(url, ItemType.Data, 'application/json', {
      force: true,
      headers: { Authorization: '******' },
    });
    expect(item?.cachedUrl).toMatch(/^blob:/);
    expect((await cache.get(url))?.cachedUrl).toBe(item?.cachedUrl);
    expect(await cache.count(ItemType.Data)).toBe(1);
    expect(await cache.list(ItemType.Data)).toHaveLength(1);
    expect(await cache.clean()).toBe(1);
    expect(await cache.get(url)).toBeUndefined();
  });

  it('restores native media from the storage map without persisting data', async () => {
    const media = 'https://castmill.test/medias/1/video.mp4';
    const data = 'https://castmill.test/channels';
    const storage = new StorageMockup({ [data]: '{"data":[]}' });
    storage.files[media] = {
      url: 'http://127.0.0.1:9080/castmill-cache/video.mp4',
      size: 5,
      sourceUrl: media,
    };
    const cache = new MemoryCache(storage);
    await cache.init();
    expect((await cache.get(media))?.type).toBe(ItemType.Media);
    await cache.set(data, ItemType.Data, 'application/json');

    const restoredStorage = new StorageMockup({});
    restoredStorage.files[media] = storage.files[media];
    const restored = new MemoryCache(restoredStorage);
    await restored.init();
    expect((await restored.get(media))?.cachedUrl).toBe(
      storage.files[media].url
    );
    expect(await restored.get(data)).toBeUndefined();
  });

  it('keeps a previous entry when a forced refresh fails', async () => {
    const url = 'https://castmill.test/data';
    const storage = new StorageMockup({ [url]: 'old' });
    const cache = new MemoryCache(storage);
    await cache.init();
    const previous = await cache.set(url, ItemType.Data, 'text/plain');
    const store = vi
      .spyOn(storage, 'storeFile')
      .mockRejectedValueOnce(new Error('Network unavailable'));

    await expect(
      cache.set(url, ItemType.Data, 'text/plain', { force: true })
    ).rejects.toThrow('Network unavailable');
    expect((await cache.get(url))?.cachedUrl).toBe(previous?.cachedUrl);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('fetches channel JSON and widget code through memory-backed resources', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const dataUrl = 'https://castmill.test/channels';
    const codeUrl = 'https://castmill.test/widgets/example.js';
    const storage = new StorageMockup({
      [dataUrl]: '{"data":[{"id":1}]}',
      [codeUrl]: 'export default 42',
    });
    const cache = new MemoryCache(storage);
    const resources = new ResourceManager(cache);
    await resources.init();

    expect(await resources.getData(dataUrl, 0)).toEqual({
      data: [{ id: 1 }],
    });
    expect((await cache.get(dataUrl))?.type).toBe(ItemType.Data);
    expect(
      (await resources.import<{ default: number }>(codeUrl))?.default
    ).toBe(42);
    expect((await cache.get(codeUrl))?.type).toBe(ItemType.Code);
    expect(await cache.count(ItemType.Code)).toBe(1);
  });

  it('allows a failed initialization to retry', async () => {
    const storage = new StorageMockup({});
    const init = vi
      .spyOn(storage, 'init')
      .mockRejectedValueOnce(new Error('Storage unavailable'));
    const cache = new MemoryCache(storage);
    await expect(cache.init()).rejects.toThrow('Storage unavailable');
    await cache.init();
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest resource and invalidates unavailable native files', async () => {
    const first = 'https://castmill.test/one';
    const second = 'https://castmill.test/two';
    const storage = new StorageMockup({ [first]: 'one', [second]: 'two' });
    const cache = new MemoryCache(storage, 1);
    await cache.init();
    await cache.set(first, ItemType.Media, 'text/plain');
    await cache.set(second, ItemType.Media, 'text/plain');
    expect(await cache.get(first)).toBeUndefined();
    expect(await cache.count(ItemType.Media)).toBe(1);
    await cache.invalidate(second);
    expect(await cache.get(second)).toBeUndefined();
    expect(await storage.listFiles()).toEqual([]);
  });
});
