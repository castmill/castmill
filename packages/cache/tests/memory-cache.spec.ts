import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemType } from '../src/cache';
import { MemoryCache } from '../src/memory-cache';
import { ResourceManager } from '../src/resource-manager';
import { StorageMockup } from './storage.mockup';

describe('MemoryCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  it('evicts and retries when the native write rejects because storage is full', async () => {
    const first = 'https://castmill.test/medias/first';
    const second = 'https://castmill.test/medias/second';
    const third = 'https://castmill.test/medias/third';
    const storage = new StorageMockup({
      [first]: 'aaa',
      [second]: 'bbb',
      [third]: 'ccc',
    });
    const originalStore = storage.storeFile.bind(storage);
    const store = vi
      .spyOn(storage, 'storeFile')
      .mockImplementation(async (url) => {
        if (
          Object.values(storage.files).reduce(
            (sum, file) => sum + file.size,
            0
          ) +
            3 >
          6
        ) {
          throw { message: 'disk full' };
        }
        return originalStore(url);
      });
    const cache = new MemoryCache(storage, 2);
    await cache.init();
    await cache.set(first, ItemType.Media, 'video/mp4');
    await cache.set(second, ItemType.Media, 'video/mp4');

    const item = await cache.set(third, ItemType.Media, 'video/mp4');
    expect(item?.cachedUrl).toMatch(/^blob:/);
    expect(store.mock.calls.filter(([url]) => url === third)).toHaveLength(2);
    expect(await cache.get(first)).toBeUndefined();
    expect(await cache.get(second)).toBeDefined();
    expect(await cache.get(third)).toBeDefined();
    expect(await storage.listFiles()).toHaveLength(2);
  });

  it('bounds NOT_ENOUGH_SPACE retries to the number of evictable items', async () => {
    const first = 'https://castmill.test/first';
    const second = 'https://castmill.test/second';
    const third = 'https://castmill.test/third';
    const storage = new StorageMockup({ [first]: 'a', [second]: 'b' });
    const cache = new MemoryCache(storage);
    await cache.init();
    await cache.set(first, ItemType.Media, 'video/mp4');
    await cache.set(second, ItemType.Media, 'video/mp4');
    const store = vi.spyOn(storage, 'storeFile').mockResolvedValue({
      result: { code: 'FAILURE', error: 'NOT_ENOUGH_SPACE' },
    });

    await expect(cache.set(third, ItemType.Media, 'video/mp4')).rejects.toThrow(
      'NOT_ENOUGH_SPACE'
    );
    expect(store).toHaveBeenCalledTimes(3);
    expect(await cache.count(ItemType.Media)).toBe(0);
    expect(await storage.listFiles()).toHaveLength(0);
  });

  it('does not evict for unrelated write errors or unknown failure results', async () => {
    const first = 'https://castmill.test/first';
    const storage = new StorageMockup({ [first]: 'a' });
    const cache = new MemoryCache(storage);
    await cache.init();
    const previous = await cache.set(first, ItemType.Media, 'video/mp4');
    const deleteFile = vi.spyOn(storage, 'deleteFile');
    const store = vi
      .spyOn(storage, 'storeFile')
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        result: { code: 'FAILURE', error: 'UNKNOWN', errMsg: 'disk full' },
      });

    await expect(
      cache.set('https://castmill.test/other', ItemType.Media, 'video/mp4')
    ).rejects.toThrow('Network unavailable');
    await expect(
      cache.set('https://castmill.test/other', ItemType.Media, 'video/mp4')
    ).rejects.toThrow('UNKNOWN');
    expect(store).toHaveBeenCalledTimes(2);
    expect(deleteFile).not.toHaveBeenCalled();
    expect((await cache.get(first))?.cachedUrl).toBe(previous?.cachedUrl);
  });

  it('preserves the previous file when a forced refresh cannot make room', async () => {
    const url = 'https://castmill.test/medias/video';
    const storage = new StorageMockup({ [url]: 'old' });
    const cache = new MemoryCache(storage);
    await cache.init();
    const previous = await cache.set(url, ItemType.Media, 'video/mp4');
    const store = vi
      .spyOn(storage, 'storeFile')
      .mockRejectedValue(
        Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })
      );
    const deleteFile = vi.spyOn(storage, 'deleteFile');

    await expect(
      cache.set(url, ItemType.Media, 'video/mp4', { force: true })
    ).rejects.toThrow('No space left on device');
    expect(store).toHaveBeenCalledTimes(1);
    expect(deleteFile).not.toHaveBeenCalled();
    expect((await cache.get(url))?.cachedUrl).toBe(previous?.cachedUrl);
  });

  it('stops retrying when an eviction fails', async () => {
    const first = 'https://castmill.test/first';
    const storage = new StorageMockup({ [first]: 'a' });
    const cache = new MemoryCache(storage);
    await cache.init();
    await cache.set(first, ItemType.Media, 'video/mp4');
    const store = vi.spyOn(storage, 'storeFile').mockResolvedValue({
      result: { code: 'FAILURE', error: 'NOT_ENOUGH_SPACE' },
    });
    vi.spyOn(storage, 'deleteFile').mockRejectedValue(
      new Error('Native remove failed')
    );

    await expect(
      cache.set('https://castmill.test/second', ItemType.Media, 'video/mp4')
    ).rejects.toThrow('Native remove failed');
    expect(store).toHaveBeenCalledTimes(1);
    expect(await cache.get(first)).toBeDefined();
  });
});
