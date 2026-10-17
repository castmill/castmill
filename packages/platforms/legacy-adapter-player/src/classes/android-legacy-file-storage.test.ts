import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache, ItemType } from '@castmill/cache';
import { AndroidLegacyFileStorage } from './android-legacy-file-storage';

vi.mock('../android-legacy-api', () => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  downloadFile: vi
    .fn()
    .mockImplementation(
      async (_url: string, localPath: string) =>
        `content://com.castmill.files/${localPath}`
    ),
  fileExists: vi.fn().mockResolvedValue(true),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  deletePath: vi.fn().mockResolvedValue(undefined),
}));

import {
  deleteFile,
  deletePath,
  downloadFile,
  fileExists,
  getItem,
  setItem,
} from '../android-legacy-api';

describe('AndroidLegacyFileStorage', () => {
  let storage: AndroidLegacyFileStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
  });

  it('uses a new local URI when the same source URL is rewritten', async () => {
    const url = 'https://castmill.example/devices/1/channels';

    const first = await storage.storeFile(url);
    const second = await storage.storeFile(url);

    expect(first.item?.url).not.toBe(second.item?.url);
    expect(downloadFile).toHaveBeenCalledTimes(2);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes a superseded local URI without removing the current mapping', async () => {
    const url = 'https://castmill.example/devices/1/channels';
    const first = await storage.storeFile(url);
    const second = await storage.storeFile(url);

    await storage.deleteFile(first.item!.url);

    expect(deleteFile).toHaveBeenCalledWith(first.item!.url);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes the native file and mapping when given its source URL', async () => {
    const url = 'https://castmill.example/media/image.png';
    const stored = await storage.storeFile(url);

    await storage.deleteFile(url);

    expect(deleteFile).toHaveBeenCalledWith(stored.item!.url);
    expect(await storage.retrieveFile(url)).toBeUndefined();
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
    expect(getItem).toHaveBeenCalledWith('FILE_MAP');
  });

  it('deletes stale mapped localhost files before replacing their mapping', async () => {
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([
        [
          'https://192.168.1.10/media/image.png',
          { url: 'content://stale-file', size: 123 },
        ],
      ])
    );

    vi.stubEnv('VITE_FILE_HOST', '192.168.1.10');
    storage = new AndroidLegacyFileStorage('');
    await storage.init();

    try {
      await storage.storeFile('https://localhost/media/image.png');
      expect(deleteFile).toHaveBeenCalledWith('content://stale-file');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('resets a malformed FILE_MAP and remains usable', async () => {
    vi.mocked(getItem).mockResolvedValueOnce('{not-json');
    storage = new AndroidLegacyFileStorage('');

    await expect(storage.init()).resolves.toBeUndefined();
    expect(setItem).toHaveBeenCalledWith('FILE_MAP', '[]');

    const stored = await storage.storeFile(
      'https://castmill.example/media/recovered.png'
    );
    expect(stored.result.code).toBe('SUCCESS');
  });

  it('cleans native files still referenced by IndexedDB after FILE_MAP corruption', async () => {
    const sourceUrl = 'https://castmill.example/media/orphaned.png';
    const initialStorage = new AndroidLegacyFileStorage('');
    const initialCache = new Cache(
      initialStorage,
      'legacy-corrupt-file-map',
      10
    );
    await initialCache.init();
    const stored = await initialCache.set(
      sourceUrl,
      ItemType.Media,
      'image/png'
    );
    initialCache.close();

    vi.mocked(getItem).mockResolvedValueOnce('{not-json');
    const recoveredStorage = new AndroidLegacyFileStorage('');
    const recoveredCache = new Cache(
      recoveredStorage,
      'legacy-corrupt-file-map',
      10
    );

    await recoveredCache.init();

    expect(deleteFile).toHaveBeenCalledWith(stored!.cachedUrl);
    expect(await recoveredCache.get(sourceUrl)).toBeUndefined();
    recoveredCache.close();
  });

  it('resets a structurally invalid FILE_MAP', async () => {
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([['source-url', { url: 42, size: 'large' }]])
    );
    storage = new AndroidLegacyFileStorage('');

    await storage.init();

    expect(await storage.listFiles()).toEqual([]);
    expect(setItem).toHaveBeenCalledWith('FILE_MAP', '[]');
  });

  it('removes mappings whose native files have disappeared', async () => {
    const localUrl = 'content://com.optimalbits.fileprovider/cache/missing.png';
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([
        [
          'https://castmill.example/media/missing.png',
          { url: localUrl, size: 1000000 },
        ],
      ])
    );
    vi.mocked(fileExists).mockResolvedValueOnce(false);
    storage = new AndroidLegacyFileStorage('');
    await storage.init();

    await expect(storage.listFiles()).resolves.toEqual([]);
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
  });

  it('keeps mappings when an older Android wrapper lacks fileExists', async () => {
    const file = {
      url: 'content://com.optimalbits.fileprovider/cache/existing.png',
      size: 1000000,
    };
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([['https://castmill.example/media/existing.png', file]])
    );
    vi.mocked(fileExists).mockRejectedValueOnce(
      new Error('function not implemented')
    );
    storage = new AndroidLegacyFileStorage('');
    await storage.init();

    await expect(storage.listFiles()).resolves.toEqual([file]);
  });

  it('reports native disk exhaustion as recoverable capacity pressure', async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce(new Error('CacheFull'));

    await expect(
      storage.storeFile('https://castmill.example/media/movie.mp4')
    ).resolves.toEqual({
      result: {
        code: 'FAILURE',
        error: 'NOT_ENOUGH_SPACE',
        errMsg: '10000000',
      },
    });
  });

  it('deletes the complete storage path so orphan files are also removed', async () => {
    await storage.storeFile('https://castmill.example/media/first.png');
    await storage.storeFile('https://castmill.example/media/second.mp4');

    await storage.deleteAllFiles();

    expect(deletePath).toHaveBeenCalledWith('');
    expect(await storage.listFiles()).toEqual([]);
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
  });
});
