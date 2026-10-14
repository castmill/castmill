import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemType, MemoryCache, ResourceManager } from '@castmill/cache';
import { sha256 } from 'js-sha256';
import {
  FileStorage,
  MAX_PERSISTED_TEXT_BYTES,
  SCAP_IO_CHUNK_BYTES,
} from './file-storage';
import { storage as api } from '../native';

vi.mock('../native', () => ({
  storage: {
    exists: vi.fn(),
    mkdir: vi.fn(),
    listFiles: vi.fn(),
    moveFile: vi.fn(),
    removeFile: vi.fn(),
    statFile: vi.fn(),
    copyFile: vi.fn(),
    getStorageInfo: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

const ROOT = 'file://internal/castmill-cache';
const MAP_KEY = 'castmill-webos-native-file-map';
const video = 'https://api.test/medias/movie.final.mp4';
const localUrl = (url: string) =>
  `http://127.0.0.1:9080/castmill-cache/${sha256(url)}.mp4`;
const stat: StatFileResponse = {
  size: 500,
  type: 'file',
  atime: '',
  mtime: '',
  ctime: '',
};

const RealFileReader = FileReader;

class MockXHR {
  static requests: MockXHR[] = [];
  responseType = '';
  timeout = 0;
  status = 200;
  response = new Blob(['protected']);
  onload?: () => void;
  url = '';
  headers: Record<string, string> = {};
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send() {
    MockXHR.requests.push(this);
    const body = this.response;
    if (this.responseType === 'arraybuffer' && body instanceof Blob) {
      const reader = new RealFileReader();
      reader.onload = () => {
        this.response = reader.result as unknown as Blob;
        this.onload?.();
      };
      reader.readAsArrayBuffer(body);
      return;
    }
    this.onload?.();
  }
}

describe('WebOS native storage routing', () => {
  let storage: FileStorage;
  let revoke: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.stubGlobal('indexedDB', undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.exists).mockResolvedValue({ exists: true });
    vi.mocked(api.mkdir).mockResolvedValue(undefined);
    vi.mocked(api.listFiles).mockResolvedValue({ files: [], totalCount: 0 });
    vi.mocked(api.moveFile).mockResolvedValue(undefined);
    vi.mocked(api.removeFile).mockResolvedValue(undefined);
    vi.mocked(api.copyFile).mockResolvedValue(undefined);
    vi.mocked(api.writeFile).mockResolvedValue({} as WriteFileResponse);
    vi.mocked(api.statFile).mockResolvedValue(stat);
    vi.mocked(api.getStorageInfo).mockResolvedValue({
      total: 10000,
      used: 500,
      free: 9500,
    });
    revoke = vi.fn();
    let nextBlob = 0;
    class TestURL extends URL {
      static createObjectURL = vi.fn(() => `blob:resource-${++nextBlob}`);
      static revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', TestURL);
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    MockXHR.requests = [];
    storage = new FileStorage();
    storage.setServerOrigin('https://api.test');
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('atomically stores eligible native media without auth headers', async () => {
    const result = await storage.storeFile(video, {
      type: ItemType.Media,
      headers: { Authorization: 'private-token' },
    });
    expect(result).toEqual({
      result: { code: 'SUCCESS' },
      item: { sourceUrl: video, url: localUrl(video), size: 500 },
    });
    expect(api.copyFile).toHaveBeenCalledWith({
      source: video,
      destination: expect.stringMatching(
        new RegExp(`${sha256(video)}\\.mp4-\\d+\\.tmp$`)
      ),
    });
    expect(api.moveFile).toHaveBeenCalledWith({
      oldPath: vi.mocked(api.copyFile).mock.calls[0][0].destination,
      newPath: `${ROOT}/${sha256(video)}.mp4`,
    });
    expect(api.statFile).toHaveBeenCalledWith({
      path: `${ROOT}/${sha256(video)}.mp4`,
    });
    expect(localStorage.getItem(MAP_KEY)).not.toContain('private-token');
    expect(await storage.retrieveFile(video)).toBe(localUrl(video));
    expect(await storage.listFiles()).toEqual([result.item]);
    // SCAP total is KB; cached file sizes are bytes.
    expect(await storage.info()).toEqual({ total: 10000 * 1024, used: 500 });
  });

  it.each([
    ['https://api.test/protected.mp4', ItemType.Media],
    [`${video}?token=secret`, ItemType.Media],
    [`${video}#secret`, ItemType.Media],
    ['https://user:password@cdn.test/movie.mp4', ItemType.Media],
    ['file:///internal/movie.mp4', ItemType.Media],
    ['https://cdn.test/movie.mp4', undefined],
  ])('keeps %s in session memory', async (url, type) => {
    const result = await storage.storeFile(url, {
      type,
      headers: { Authorization: 'private-token' },
    });
    expect(result.item?.url).toBe('blob:resource-1');
    expect(api.copyFile).not.toHaveBeenCalled();
    expect(MockXHR.requests[0].headers).toEqual({
      Authorization: 'private-token',
    });
    expect(MockXHR.requests[0].timeout).toBe(30000);
    expect(localStorage.getItem(MAP_KEY)).toBeNull();
    expect(await storage.retrieveFile(url)).toBe('blob:resource-1');
    expect((await storage.info()).used).toBe(9);
    await storage.deleteFile(url);
    expect(revoke).toHaveBeenCalledWith('blob:resource-1');
    expect(await storage.retrieveFile(url)).toBeUndefined();
  });

  it('does not collide across origins or multi-dot filenames', async () => {
    const second = 'https://cdn.test/medias/movie.final.mp4';
    await storage.storeFile(video, { type: ItemType.Media });
    await storage.storeFile(second, { type: ItemType.Media });
    expect(await storage.retrieveFile(video)).not.toBe(
      await storage.retrieveFile(second)
    );
    const result = await storage.storeFile('https://cdn.test/media', {
      type: ItemType.Media,
    });
    expect(result.item?.url).toMatch(/\/[a-f0-9]{64}$/);
  });

  it('restores media metadata on restart without opening IndexedDB', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    vi.mocked(api.listFiles).mockResolvedValue({
      files: [{ name: `${sha256(video)}.mp4`, size: 500 }],
      totalCount: 1,
    });
    const restarted = new FileStorage();
    const cache = new MemoryCache(restarted);
    await cache.init();
    expect((await cache.get(video))?.cachedUrl).toBe(localUrl(video));
    expect(api.copyFile).toHaveBeenCalledOnce();
    await restarted.close();
  });

  it('initializes an absent directory only once', async () => {
    vi.mocked(api.exists).mockResolvedValueOnce({ exists: false });
    storage = new FileStorage();
    await Promise.all([storage.init(), storage.init()]);
    expect(api.mkdir).toHaveBeenCalledOnce();
  });

  it('allows retry after initialization failure', async () => {
    const error = new Error('Native storage unavailable');
    vi.mocked(api.exists).mockRejectedValueOnce(error);
    storage = new FileStorage();
    await expect(storage.init()).rejects.toBe(error);
    await storage.init();
  });

  it.each([
    '{invalid',
    '{}',
    '[[1,{}]]',
    '[["invalid-url",{}]]',
    JSON.stringify([
      [video, { url: 'file://internal/credentials.txt', size: 1 }],
    ]),
    JSON.stringify([[video, { url: localUrl(video), size: -1 }]]),
  ])('resets corrupt metadata and scoped native files (%s)', async (saved) => {
    localStorage.setItem(MAP_KEY, saved);
    storage = new FileStorage();
    await storage.init();
    expect(api.removeFile).toHaveBeenCalledWith({
      file: ROOT,
      recursive: true,
    });
    expect(api.mkdir).toHaveBeenCalledOnce();
    expect(localStorage.getItem(MAP_KEY)).toBe('[]');
    expect(await storage.listFiles()).toEqual([]);
  });

  it('reconciles missing files and removes only safe orphan cache paths', async () => {
    localStorage.setItem(
      MAP_KEY,
      JSON.stringify([[video, { url: localUrl(video), size: 500 }]])
    );
    vi.mocked(api.listFiles).mockResolvedValue({
      files: [{ name: 'old-cache.mp4' }, { name: '../credentials.txt' }, {}],
      totalCount: 3,
    });
    storage = new FileStorage();
    await storage.init();
    expect(await storage.listFiles()).toEqual([]);
    expect(api.removeFile).toHaveBeenCalledOnce();
    expect(api.removeFile).toHaveBeenCalledWith({
      file: `${ROOT}/old-cache.mp4`,
    });
    expect(console.warn).toHaveBeenCalled();
  });

  it.each(['source', 'cached'])(
    'deletes native media by its %s URL',
    async (kind) => {
      await storage.storeFile(video, { type: ItemType.Media });
      await storage.deleteFile(kind === 'source' ? video : localUrl(video));
      expect(api.removeFile).toHaveBeenCalledWith({
        file: `${ROOT}/${sha256(video)}.mp4`,
      });
      expect(await storage.listFiles()).toEqual([]);
      expect(localStorage.getItem(MAP_KEY)).toBe('[]');
    }
  );

  it('treats absent files as removed but surfaces other native errors', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    vi.mocked(api.exists).mockResolvedValueOnce({ exists: false });
    await storage.deleteFile(video);
    expect(api.removeFile).not.toHaveBeenCalled();
    await storage.storeFile(video, { type: ItemType.Media });
    vi.mocked(api.removeFile).mockRejectedValueOnce(
      new Error('Permission denied')
    );
    await expect(storage.deleteFile(video)).rejects.toThrow(
      'Permission denied'
    );
    expect(await storage.retrieveFile(video)).toBe(localUrl(video));
    await storage.deleteFile('blob:missing');
  });

  it('redownloads a missing native video through ResourceManager recovery', async () => {
    const cache = new MemoryCache(storage);
    await cache.init();
    const resources = new ResourceManager(cache);
    expect(await resources.getMedia(video)).toBe(localUrl(video));
    vi.mocked(api.exists).mockResolvedValueOnce({ exists: false });
    expect(await resources.refreshMedia(video)).toBe(localUrl(video));
    expect(api.copyFile).toHaveBeenCalledTimes(2);
  });

  it('clears native and session storage and recreates the cache directory', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    await storage.storeFile('https://api.test/data', { type: ItemType.Data });
    await storage.deleteAllFiles();
    expect(api.removeFile).toHaveBeenCalledWith({
      file: ROOT,
      recursive: true,
    });
    expect(api.mkdir).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:resource-1');
    expect(await storage.listFiles()).toEqual([]);
    await storage.storeFile(video, { type: ItemType.Media });
    expect(await storage.retrieveFile(video)).toBe(localUrl(video));
  });

  it.each(['copy', 'move', 'stat'])(
    'cleans up after a %s failure and rejects',
    async (step) => {
      const failure = new Error(`${step} failed`);
      if (step === 'copy')
        vi.mocked(api.copyFile).mockRejectedValueOnce(failure);
      if (step === 'move')
        vi.mocked(api.moveFile).mockRejectedValueOnce(failure);
      if (step === 'stat')
        vi.mocked(api.statFile).mockRejectedValueOnce(failure);
      await expect(
        storage.storeFile(video, { type: ItemType.Media })
      ).rejects.toBe(failure);
      const path = vi.mocked(api.removeFile).mock.calls[0][0].file;
      expect(path).toMatch(step === 'stat' ? /\.mp4$/ : /\.tmp$/);
      expect(await storage.listFiles()).toEqual([]);
    }
  );

  it('logs cleanup failures without hiding the original error', async () => {
    vi.mocked(api.copyFile).mockRejectedValueOnce(new Error('Copy failed'));
    vi.mocked(api.removeFile).mockRejectedValueOnce(
      new Error('Cleanup failed')
    );
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toThrow('Copy failed');
    expect(console.error).toHaveBeenCalledWith(
      'WebOS Storage: failed to remove incomplete download',
      expect.any(Error)
    );
  });

  it.each([NaN, -1])('rejects invalid SCAP file sizes (%s)', async (size) => {
    vi.mocked(api.statFile).mockResolvedValueOnce({ ...stat, size });
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toThrow('invalid cached file size');
  });

  it('rolls back a new file if its mapping cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Metadata full');
    });
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toThrow('Metadata full');
    expect(api.removeFile).toHaveBeenCalledWith({
      file: `${ROOT}/${sha256(video)}.mp4`,
    });
    expect(await storage.listFiles()).toEqual([]);
  });

  it('preserves an existing native mapping if forced refresh fails to commit', async () => {
    await storage.storeFile(video, { type: ItemType.Media });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Metadata full');
    });
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toThrow('Metadata full');
    expect(api.removeFile).not.toHaveBeenCalled();
    expect(await storage.retrieveFile(video)).toBe(localUrl(video));
  });

  it.each([
    { errorCode: 'NOT_ENOUGH_SPACE' },
    { errorText: 'No space left on device' },
    { code: 'ENOSPC' },
    new Error('disk full'),
  ])('translates recognized storage-full errors: %j', async (failure) => {
    vi.mocked(api.copyFile).mockRejectedValueOnce(failure);
    expect(await storage.storeFile(video, { type: ItemType.Media })).toEqual({
      result: { code: 'FAILURE', error: 'NOT_ENOUGH_SPACE' },
    });
  });

  it.each([
    undefined,
    'IO_ERROR',
    { errorCode: 'IO_ERROR', errorText: 'Network failed' },
  ])('does not misclassify unrelated failures: %j', async (failure) => {
    vi.mocked(api.copyFile).mockRejectedValueOnce(failure);
    await expect(
      storage.storeFile(video, { type: ItemType.Media })
    ).rejects.toBe(failure);
  });

  it('evicts cached media and retries only recognized full-storage writes', async () => {
    const cache = new MemoryCache(storage);
    await cache.init();
    await cache.set(video, ItemType.Media, 'video/mp4');
    vi.mocked(api.copyFile).mockRejectedValueOnce({
      errorText: 'Not enough space',
    });
    const next = 'https://cdn.test/next.mp4';
    await cache.set(next, ItemType.Media, 'video/mp4');
    expect(await cache.get(video)).toBeUndefined();
    expect((await cache.get(next))?.cachedUrl).toBe(localUrl(next));
  });

  it('rewrites only localhost hostnames and keeps URLs out of debug logs', async () => {
    vi.stubEnv('VITE_FILE_HOST', '192.0.2.1');
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    storage = new FileStorage();
    await storage.init();
    const url = 'http://localhost:4000/medias/localhost.mp4';
    await storage.storeFile(url, { type: ItemType.Media });
    expect(api.copyFile).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'http://192.0.2.1:4000/medias/localhost.mp4',
      })
    );
    await storage.storeFile(video, { type: ItemType.Media });
    expect(vi.mocked(api.copyFile).mock.calls[1][0].source).toBe(video);
    await storage.storeFile('https://api.test/data?token=secret', {
      type: ItemType.Data,
    });
    expect(log.mock.calls.flat().join(' ')).not.toContain('token=secret');
    expect(log.mock.calls.flat().join(' ')).not.toContain('/medias/');
  });
  describe('offline data and code', () => {
    const channels = 'https://api.test/devices/1/channels';
    const widget = 'https://cdn.test/widget.js';
    const writtenPath = (call = 0) =>
      vi.mocked(api.moveFile).mock.calls[call][0].newPath;
    let disk: Map<string, Uint8Array>;

    // In-memory SCAP filesystem enforcing the 10 KB per-call IO limit.
    beforeEach(() => {
      disk = new Map();
      vi.mocked(api.writeFile).mockImplementation(async (options) => {
        const data = new Uint8Array(options.data as ArrayBuffer);
        expect(options.encoding).toBe('binary');
        expect(data.byteLength).toBeLessThanOrEqual(SCAP_IO_CHUNK_BYTES);
        const previous =
          options.mode === 'append'
            ? (disk.get(options.path) ?? new Uint8Array())
            : new Uint8Array();
        const next = new Uint8Array(previous.length + data.length);
        next.set(previous);
        next.set(data, previous.length);
        disk.set(options.path, next);
        return { written: data.length } as WriteFileResponse;
      });
      vi.mocked(api.moveFile).mockImplementation(
        async ({ oldPath, newPath }) => {
          const data = disk.get(oldPath);
          if (data) disk.set(newPath, data);
          disk.delete(oldPath);
        }
      );
      vi.mocked(api.statFile).mockImplementation(async ({ path }) => ({
        ...stat,
        size: disk.get(path)?.length ?? 0,
      }));
      vi.mocked(api.readFile).mockImplementation(async (options) => {
        expect(options.length).toBeLessThanOrEqual(SCAP_IO_CHUNK_BYTES);
        const data = disk.get(options.path);
        if (!data || options.position! >= data.length) {
          throw { errorCode: 'IO_ERROR', errorText: 'out of range' };
        }
        const chunk = data.slice(
          options.position,
          options.position! + options.length!
        );
        return { data: chunk.buffer };
      });
    });
    const restartWith = async (paths: string[]) => {
      vi.mocked(api.listFiles).mockResolvedValue({
        files: paths.map((path) => ({
          name: path.slice(path.lastIndexOf('/') + 1),
          size: 9,
        })),
        totalCount: paths.length,
      });
      const restarted = new FileStorage();
      const cache = new MemoryCache(restarted);
      await cache.init();
      return { restarted, cache };
    };

    it.each([
      [channels, ItemType.Data, 'json'],
      [widget, ItemType.Code, 'js'],
    ])(
      'persists %s after an authenticated download',
      async (url, type, extension) => {
        const result = await storage.storeFile(url, {
          type,
          headers: { Authorization: 'private-token' },
        });

        expect(result.item?.url).toBe('blob:resource-1');
        expect(MockXHR.requests[0].headers).toEqual({
          Authorization: 'private-token',
        });
        expect(MockXHR.requests[1].url).toBe('blob:resource-1');
        expect(api.copyFile).not.toHaveBeenCalled();
        expect(vi.mocked(api.writeFile).mock.calls[0][0]).toMatchObject({
          path: expect.stringMatching(/\.tmp$/),
          encoding: 'binary',
          mode: 'truncate',
        });
        expect(writtenPath()).toMatch(
          new RegExp(`^${ROOT}/[a-f0-9]{64}\\.${extension}$`)
        );
        expect(localStorage.getItem(MAP_KEY)).not.toContain('private-token');
        expect(await storage.retrieveFile(url)).toBe('blob:resource-1');
        expect(await storage.listFiles()).toEqual([
          expect.objectContaining({
            sourceUrl: url,
            url: 'blob:resource-1',
            type,
            storedAt: expect.any(Number),
          }),
        ]);
        expect((await storage.info()).used).toBe(9);
      }
    );

    it('restores persisted data for an offline cold start', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234);
      const cache = new MemoryCache(storage);
      await cache.init();
      await cache.set(channels, ItemType.Data, 'application/json');
      const path = writtenPath();

      const { restarted, cache: restartedCache } = await restartWith([path]);
      const restored = await restartedCache.get(channels);

      expect(api.readFile).toHaveBeenCalledWith({
        path,
        position: 0,
        length: 9,
        encoding: 'binary',
      });
      expect(restored).toMatchObject({
        type: ItemType.Data,
        mimeType: 'application/json',
        storedAt: 1234,
        cachedUrl: expect.stringMatching(/^blob:/),
      });
      await restarted.close();
      expect(revoke).toHaveBeenCalledWith(restored?.cachedUrl);
    });

    it('writes and restores content larger than one SCAP IO chunk', async () => {
      const text = `{"data":"${'é'.repeat(SCAP_IO_CHUNK_BYTES)}"}`;
      const send = MockXHR.prototype.send;
      vi.spyOn(MockXHR.prototype, 'send').mockImplementation(
        function (this: MockXHR) {
          this.response = new Blob([text]);
          send.call(this);
        }
      );
      await storage.storeFile(channels, { type: ItemType.Data });
      const path = writtenPath();
      const bytes = new Blob([text]).size;
      expect(api.writeFile).toHaveBeenCalledTimes(
        Math.ceil(bytes / SCAP_IO_CHUNK_BYTES)
      );
      expect(vi.mocked(api.writeFile).mock.calls[1][0].mode).toBe('append');

      let restoredBlob: Blob | undefined;
      vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
        restoredBlob = blob as Blob;
        return 'blob:restored';
      });
      const { restarted, cache } = await restartWith([path]);

      expect((await cache.get(channels))?.cachedUrl).toBe('blob:restored');
      expect(api.readFile).toHaveBeenCalledTimes(
        Math.ceil(bytes / SCAP_IO_CHUNK_BYTES)
      );
      const restoredText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(restoredBlob!);
      });
      expect(restoredText).toBe(text);
      await restarted.close();
    });

    it('persists without FileReader.readAsArrayBuffer (cordova shim)', async () => {
      // Cordova's webOS FileReader only implements readAsText.
      vi.stubGlobal(
        'FileReader',
        class {
          readAsText() {
            throw new Error('cordova FileReader used');
          }
        }
      );

      await storage.storeFile(channels, { type: ItemType.Data });

      expect(console.error).not.toHaveBeenCalled();
      expect(api.moveFile).toHaveBeenCalledTimes(1);
    });

    it('rejects a write whose stored size does not match', async () => {
      vi.mocked(api.statFile).mockResolvedValueOnce({ ...stat, size: 1 });

      const result = await storage.storeFile(channels, {
        type: ItemType.Data,
      });

      expect(result.result.code).toBe('SUCCESS');
      expect(api.moveFile).not.toHaveBeenCalled();
      expect(localStorage.getItem(MAP_KEY)).toBeNull();
    });

    it('does not persist empty responses', async () => {
      const send = MockXHR.prototype.send;
      vi.spyOn(MockXHR.prototype, 'send').mockImplementationOnce(
        function (this: MockXHR) {
          this.response = new Blob([]);
          send.call(this);
        }
      );

      await storage.storeFile(channels, { type: ItemType.Data });

      expect(api.writeFile).not.toHaveBeenCalled();
    });

    it('drops truncated persisted data on restart', async () => {
      await storage.storeFile(channels, { type: ItemType.Data });
      const path = writtenPath();
      disk.set(path, new Uint8Array(3));

      const { restarted, cache } = await restartWith([path]);

      expect(await cache.get(channels)).toBeUndefined();
      expect(api.removeFile).toHaveBeenCalledWith({ file: path });
      expect(localStorage.getItem(MAP_KEY)).toBe('[]');
      await restarted.close();
    });

    it('replaces the previous persisted copy after a refresh', async () => {
      await storage.storeFile(channels, { type: ItemType.Data });
      const first = writtenPath();
      await storage.storeFile(channels, { type: ItemType.Data, force: true });

      expect(writtenPath(1)).not.toBe(first);
      expect(api.removeFile).toHaveBeenCalledWith({ file: first });
      expect(revoke).toHaveBeenCalledWith('blob:resource-1');
      expect(await storage.retrieveFile(channels)).toBe('blob:resource-2');
      expect(await storage.listFiles()).toHaveLength(1);
    });

    it.each(['write', 'oversize'])(
      'keeps the fresh session copy and forgets the older one on %s failure',
      async (failure) => {
        await storage.storeFile(channels, { type: ItemType.Data });
        const first = writtenPath();
        if (failure === 'write') {
          vi.mocked(api.writeFile).mockRejectedValueOnce(new Error('full'));
        } else {
          const send = MockXHR.prototype.send;
          vi.spyOn(MockXHR.prototype, 'send').mockImplementationOnce(
            function (this: MockXHR) {
              this.response = new Blob([
                'x'.repeat(MAX_PERSISTED_TEXT_BYTES + 1),
              ]);
              send.call(this);
            }
          );
        }
        const result = await storage.storeFile(channels, {
          type: ItemType.Data,
          force: true,
        });
        expect(result.result.code).toBe('SUCCESS');

        expect(api.removeFile).toHaveBeenCalledWith({ file: first });
        expect(await storage.retrieveFile(channels)).toBe('blob:resource-2');
        expect(localStorage.getItem(MAP_KEY)).toBe('[]');
      }
    );

    it('keeps the session copy when the file map cannot be saved', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

      const result = await storage.storeFile(channels, {
        type: ItemType.Data,
      });

      expect(result.result.code).toBe('SUCCESS');
      expect(api.removeFile).toHaveBeenCalledWith({ file: writtenPath() });
      expect(await storage.retrieveFile(channels)).toBe('blob:resource-1');
      expect(localStorage.getItem(MAP_KEY)).toBeNull();
    });

    it('deletes persisted data by its session URL', async () => {
      await storage.storeFile(widget, { type: ItemType.Code });
      const path = writtenPath();

      await storage.deleteFile('blob:resource-1');

      expect(api.removeFile).toHaveBeenCalledWith({ file: path });
      expect(revoke).toHaveBeenCalledWith('blob:resource-1');
      expect(await storage.retrieveFile(widget)).toBeUndefined();
      expect(await storage.listFiles()).toEqual([]);
    });

    it('rejects persisted data entries without a valid type or source', async () => {
      const file = `http://127.0.0.1:9080/castmill-cache/${sha256('x')}.json`;
      localStorage.setItem(
        MAP_KEY,
        JSON.stringify([
          [
            'file:///etc/passwd',
            { url: file, size: 1, type: 'data', storedAt: 1 },
          ],
        ])
      );
      const restarted = new FileStorage();
      await restarted.init();

      expect(api.removeFile).toHaveBeenCalledWith({
        file: ROOT,
        recursive: true,
      });
      expect(api.readFile).not.toHaveBeenCalled();
      await restarted.close();
    });
  });
});
