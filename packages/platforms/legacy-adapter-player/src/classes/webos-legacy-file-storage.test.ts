import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemType, MemoryCache, ResourceManager } from '@castmill/cache';
import { WebosLegacyFileStorage } from './webos-legacy-file-storage';
import {
  clearWebosFiles,
  fetchWebosFile,
  removeWebosFile,
} from '../webos-legacy-api';

vi.mock('../webos-legacy-api', () => ({
  fetchWebosFile: vi.fn(),
  removeWebosFile: vi.fn(),
  clearWebosFiles: vi.fn(),
}));

const video = `${window.location.origin}/medias/123/9/poster.mp4`;
const image = `${window.location.origin}/medias/123/9/poster.png`;
const nativeUrl = (character: string, extension: string) =>
  `http://127.0.0.1:9080/castmill-cache/${character.repeat(64)}.${extension}`;

describe('WebosLegacyFileStorage', () => {
  let storage: WebosLegacyFileStorage;

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('indexedDB', undefined);
    vi.mocked(fetchWebosFile).mockResolvedValue({
      url: nativeUrl('a', 'mp4'),
      size: 12_000_000,
    });
    storage = new WebosLegacyFileStorage();
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
    vi.unstubAllGlobals();
  });

  it('stores video through native files and restores its URL across restarts', async () => {
    const cache = new MemoryCache(storage, 100);
    await cache.init();
    const stored = await cache.set(video, ItemType.Media, 'video/mp4', {
      force: false,
      headers: { Authorization: 'Bearer private-token' },
    });
    expect(fetchWebosFile).toHaveBeenCalledWith(video);
    expect(stored?.cachedUrl).toBe(nativeUrl('a', 'mp4'));
    expect((await storage.info()).used).toBe(12_000_000);
    expect(localStorage.getItem('castmill-webos-file-map')).not.toContain(
      'private-token'
    );
    cache.close();
    await storage.close();

    storage = new WebosLegacyFileStorage();
    const restored = new MemoryCache(storage, 100);
    await restored.init();
    expect((await restored.get(video))?.cachedUrl).toBe(nativeUrl('a', 'mp4'));
    expect(fetchWebosFile).toHaveBeenCalledOnce();

    await restored.del(video);
    expect(removeWebosFile).toHaveBeenCalledWith(
      `file://internal/castmill-cache/${'a'.repeat(64)}.mp4`
    );
    expect(await storage.listFiles()).toEqual([]);
    restored.close();
  });

  it('uses native storage for images and cleans all native files, including orphans', async () => {
    vi.mocked(fetchWebosFile).mockResolvedValueOnce({
      url: nativeUrl('b', 'png'),
      size: 800,
    });
    await storage.storeFile(image, { type: ItemType.Media });
    expect(await storage.retrieveFile(image)).toBe(nativeUrl('b', 'png'));

    await storage.deleteAllFiles();
    expect(clearWebosFiles).toHaveBeenCalledOnce();
    expect(await storage.listFiles()).toEqual([]);
    expect(localStorage.getItem('castmill-webos-file-map')).toBe('[]');
  });

  it('keeps protected data in memory with Authorization headers', async () => {
    const url = `${window.location.origin}/devices/123/channels`;
    const requests: Array<{ url: string; headers: Record<string, string> }> =
      [];
    class TestURL extends URL {
      static createObjectURL = vi.fn(() => 'blob:protected-data');
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal('URL', TestURL);
    class MockXHR {
      status = 200;
      response = new Blob(['{"ok":true}'], { type: 'application/json' });
      responseType = '';
      onload?: () => void;
      private url = '';
      private headers: Record<string, string> = {};
      open(_method: string, url: string) {
        this.url = url;
      }
      setRequestHeader(key: string, value: string) {
        this.headers[key] = value;
      }
      send() {
        requests.push({ url: this.url, headers: this.headers });
        this.onload?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    const item = await storage.storeFile(url, {
      type: ItemType.Data,
      headers: { Authorization: 'Bearer private-token' },
    });
    const signedMedia = `${video}?auth=private-token`;
    await storage.storeFile(signedMedia, {
      type: ItemType.Media,
      headers: { Authorization: 'Bearer private-token' },
    });
    expect(item.item?.url).toMatch(/^blob:/);
    expect(requests).toEqual([
      { url, headers: { Authorization: 'Bearer private-token' } },
      { url: signedMedia, headers: { Authorization: 'Bearer private-token' } },
    ]);
    expect(fetchWebosFile).not.toHaveBeenCalled();
    expect(localStorage.getItem('castmill-webos-file-map')).toBeNull();
    await storage.deleteFile(url);
    await storage.deleteFile(signedMedia);
    expect(await storage.listFiles()).toEqual([]);
  });

  it('does not mark failed native downloads as cached', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchWebosFile).mockRejectedValueOnce(new Error('disk full'));
    const cache = new MemoryCache(storage, 100);
    await cache.init();
    await expect(
      cache.set(video, ItemType.Media, 'video/mp4', { force: false })
    ).rejects.toThrow('disk full');
    expect(await cache.get(video)).toBeUndefined();
    expect(await storage.listFiles()).toEqual([]);
    cache.close();
    errorLog.mockRestore();
  });

  it('preserves mappings when native removal fails', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    vi.mocked(removeWebosFile).mockRejectedValueOnce(
      new Error('remove failed')
    );
    await expect(storage.deleteFile(video)).rejects.toThrow('remove failed');
    expect(await storage.retrieveFile(video)).toBe(nativeUrl('a', 'mp4'));
  });

  it('redownloads a missing native video even if native removal fails', async () => {
    const cache = new MemoryCache(storage, 100);
    await cache.init();
    const resources = new ResourceManager(cache);
    expect(await resources.getMedia(video)).toBe(nativeUrl('a', 'mp4'));
    vi.mocked(removeWebosFile).mockRejectedValueOnce(
      new Error('Native file already missing')
    );
    vi.mocked(fetchWebosFile).mockResolvedValueOnce({
      url: nativeUrl('b', 'mp4'),
      size: 12_000_000,
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await resources.refreshMedia(video)).toBe(nativeUrl('b', 'mp4'));
      expect(await storage.retrieveFile(video)).toBe(nativeUrl('b', 'mp4'));
      expect((await cache.get(video))?.cachedUrl).toBe(nativeUrl('b', 'mp4'));
      expect(fetchWebosFile).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
      cache.close();
    }
  });

  it('resets a corrupt map and removes any orphaned native files', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    await storage.close();
    localStorage.setItem('castmill-webos-file-map', '{invalid');
    storage = new WebosLegacyFileStorage();
    await storage.init();
    expect(clearWebosFiles).toHaveBeenCalledOnce();
    expect(await storage.listFiles()).toEqual([]);
    expect(localStorage.getItem('castmill-webos-file-map')).toBe('[]');
    errorLog.mockRestore();
  });

  it('removes a new native file when its mapping cannot be persisted', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage full');
      });
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toThrow('storage full');
    expect(removeWebosFile).toHaveBeenCalledWith(
      `file://internal/castmill-cache/${'a'.repeat(64)}.mp4`
    );
    expect(await storage.listFiles()).toEqual([]);
    setItem.mockRestore();
  });

  it('downloads unsigned media from a different public origin natively', async () => {
    await storage.storeFile('https://cdn.castmill.test/movie.mp4', {
      type: ItemType.Media,
    });
    expect(fetchWebosFile).toHaveBeenCalledWith(
      'https://cdn.castmill.test/movie.mp4'
    );
  });

  it('removes superseded native files by local URL without deleting the new mapping', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    vi.mocked(fetchWebosFile).mockResolvedValueOnce({
      url: nativeUrl('c', 'mp4'),
      size: 13_000_000,
    });
    await storage.storeFile(video, { type: ItemType.Media });
    await storage.deleteFile(nativeUrl('a', 'mp4'));
    expect(removeWebosFile).toHaveBeenCalledWith(
      `file://internal/castmill-cache/${'a'.repeat(64)}.mp4`
    );
    expect(await storage.retrieveFile(video)).toBe(nativeUrl('c', 'mp4'));
  });
});
