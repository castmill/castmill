import 'fake-indexeddb/auto';
import IDBFactory from 'fake-indexeddb/lib/FDBFactory';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache, ItemType, ResourceManager } from '@castmill/cache';
import { BrowserMachine, Device } from '@castmill/device';
import { AndroidLegacyFileStorage } from './android-legacy-file-storage';
import '../polyfills/fetch';

const native = vi.hoisted(() => ({ fileMap: null as string | null }));

vi.mock('../android-legacy-api', () => ({
  getItem: vi.fn(async () => native.fileMap),
  setItem: vi.fn(async (_key: string, value: string) => {
    native.fileMap = value;
  }),
  downloadFile: vi
    .fn()
    .mockImplementation(
      async (_url: string, localPath: string) =>
        `content://com.optimalbits.fileprovider/cache/${localPath}`
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

const requests: MockXHR[] = [];
let response = { status: 200, text: '{"data":[]}', event: 'load' };
const responses = new Map<string, string>();
const cachedReads: string[] = [];
let binaryResponse: Blob | null = null;
let progressLoaded = 0;

function abortNextFileMapWrite() {
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore['put']>
  ) {
    const request = put.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
}

class MockXHR {
  method = '';
  url = '';
  headers: Record<string, string> = {};
  timeout = 0;
  status = 0;
  responseText = '';
  responseType = '';
  response: Blob | null = null;
  aborted = false;
  onprogress?: (event: { loaded: number; lengthComputable: boolean }) => void;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  getResponseHeader() {
    return null;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  send() {
    if (this.url.startsWith('data:')) {
      // Match Crosswalk 23: a trailing fragment is returned as response text.
      cachedReads.push(this.url);
      this.status = 200;
      this.responseText = decodeURIComponent(
        this.url.slice(this.url.indexOf(',') + 1)
      );
      this.onload?.();
      return;
    }
    requests.push(this);
    this.status = response.status;
    this.responseText = responses.get(this.url) ?? response.text;
    this.response = binaryResponse;
    if (progressLoaded) {
      this.onprogress?.({ loaded: progressLoaded, lengthComputable: false });
      if (this.aborted) return;
    }
    switch (response.event) {
      case 'load':
        this.onload?.();
        break;
      case 'error':
        this.onerror?.();
        break;
      case 'timeout':
        this.ontimeout?.();
        break;
      case 'abort':
        this.onabort?.();
        break;
    }
  }
}

describe('AndroidLegacyFileStorage', () => {
  let storage: AndroidLegacyFileStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    native.fileMap = null;
    vi.mocked(getItem)
      .mockReset()
      .mockImplementation(async () => native.fileMap);
    vi.mocked(setItem)
      .mockReset()
      .mockImplementation(async (_key, value) => {
        native.fileMap = value;
      });
    vi.mocked(downloadFile)
      .mockReset()
      .mockImplementation(
        async (_url, localPath) =>
          `content://com.optimalbits.fileprovider/cache/${localPath}`
      );
    vi.mocked(fileExists).mockReset().mockResolvedValue(true);
    vi.mocked(deleteFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(deletePath).mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('indexedDB', new IDBFactory());
    requests.length = 0;
    responses.clear();
    cachedReads.length = 0;
    response = { status: 200, text: '{"data":[]}', event: 'load' };
    binaryResponse = null;
    progressLoaded = 0;
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    vi.mocked(setItem).mockClear();
  });

  afterEach(async () => {
    await storage.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('migrates legacy payloads without changing Cache identities and restores them offline', async () => {
    const data = { data: [{ name: 'Å', id: 1 }] };
    const text = JSON.stringify(data);
    const entries = [
      {
        source: 'https://castmill.example/devices/migrated/channels',
        file: {
          url: `data:application/json;charset=utf-8;castmill-revision=1,${encodeURIComponent(text)}`,
          size: new Blob([text]).size,
        },
        type: ItemType.Data,
        mimeType: 'application/json',
      },
      {
        source: 'https://castmill.example/fonts/migrated.otf',
        file: {
          url: 'data:font/otf;castmill-revision=2;base64,AAECAw==',
          size: 4,
        },
        type: ItemType.Media,
        mimeType: 'font/otf',
      },
      {
        source: 'https://castmill.example/media/migrated.mp4',
        file: { url: 'content://native-video', size: 100 },
        type: ItemType.Media,
        mimeType: 'video/mp4',
      },
    ];
    await storage.close();
    native.fileMap = JSON.stringify(
      entries.map(({ source, file }) => [source, file])
    );
    storage = new AndroidLegacyFileStorage('');
    const name = 'legacy-preferences-migration';
    const cache = new Cache(storage, name, 10);
    await cache.items.bulkPut(
      entries.map(({ source, file, type, mimeType }) => ({
        url: source,
        cachedUrl: file.url,
        size: file.size,
        timestamp: Date.now(),
        storedAt: Date.now(),
        accessed: 0,
        type,
        mimeType,
      }))
    );
    try {
      await cache.init();
      expect(native.fileMap!.length).toBeLessThan(150);
      expect(native.fileMap).not.toContain('data:');
      expect(await cache.items.count()).toBe(entries.length);
      expect(await storage.listFiles()).toEqual(
        entries.map(({ file }) => file)
      );
    } finally {
      cache.close();
      await storage.close();
    }

    storage = new AndroidLegacyFileStorage('');
    const offline = new Cache(storage, name, 10);
    const resources = new ResourceManager(offline);
    response.event = 'error';
    try {
      await resources.init();
      expect(await resources.getData(entries[0].source, 1000)).toEqual(data);
      expect(await resources.getMedia(entries[1].source)).toBe(
        entries[1].file.url
      );
      expect(await resources.getMedia(entries[2].source)).toBe(
        entries[2].file.url
      );
      expect(requests).toHaveLength(0);
      expect(downloadFile).not.toHaveBeenCalled();
      expect(setItem).toHaveBeenCalledOnce();
    } finally {
      offline.close();
    }
  });

  it('keeps native payloads intact if the migration transaction aborts and can retry', async () => {
    await storage.close();
    const source = 'https://castmill.example/migration/channels';
    const file = { url: 'data:application/json,%7B%7D', size: 2 };
    native.fileMap = JSON.stringify([[source, file]]);
    const legacy = native.fileMap;
    abortNextFileMapWrite();

    await expect(storage.init()).rejects.toThrow();
    expect(native.fileMap).toBe(legacy);
    expect(setItem).not.toHaveBeenCalled();

    await storage.init();
    expect(await storage.retrieveFile(source)).toBe(file.url);
    expect(native.fileMap).not.toBe(legacy);
  });

  it('does not publish the migration if IndexedDB read-back differs', async () => {
    await storage.close();
    native.fileMap = JSON.stringify([
      ['source', { url: 'data:application/json,%7B%7D', size: 2 }],
    ]);
    const legacy = native.fileMap;
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (
      this: IDBObjectStore,
      _value: unknown,
      key?: IDBValidKey
    ) {
      return put.call(
        this,
        { url: 'data:application/json,changed', size: 2 },
        key
      );
    });

    await expect(storage.init()).rejects.toThrow(
      'migration verification failed'
    );
    expect(native.fileMap).toBe(legacy);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('retains the legacy map if publishing the database pointer fails', async () => {
    await storage.close();
    const source = 'https://castmill.example/migration/code.js';
    const file = { url: 'data:text/javascript,void%200', size: 6 };
    native.fileMap = JSON.stringify([[source, file]]);
    const legacy = native.fileMap;
    vi.mocked(setItem).mockRejectedValueOnce(new Error('Bridge write failed'));

    await expect(storage.init()).rejects.toThrow('Bridge write failed');
    expect(native.fileMap).toBe(legacy);
    await storage.init();
    expect(await storage.retrieveFile(source)).toBe(file.url);
  });

  it('fails explicitly without IndexedDB and leaves native storage untouched', async () => {
    await storage.close();
    const legacy = JSON.stringify([
      ['source', { url: 'data:application/json,%7B%7D', size: 2 }],
    ]);
    native.fileMap = legacy;
    vi.stubGlobal('indexedDB', undefined);

    await expect(storage.init()).rejects.toThrow('requires IndexedDB');
    expect(native.fileMap).toBe(legacy);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('persists and restores payloads without getAll, explicit commit, or IndexedDB Blobs', async () => {
    const getAll = vi
      .spyOn(IDBObjectStore.prototype, 'getAll')
      .mockImplementation(() => {
        throw new Error('Legacy IndexedDB does not support getAll');
      });
    const commit =
      typeof IDBTransaction.prototype.commit === 'function'
        ? vi
            .spyOn(IDBTransaction.prototype, 'commit')
            .mockImplementation(() => {
              throw new Error('Legacy IndexedDB does not support commit');
            })
        : undefined;
    const source = 'https://broker.images.castmill.io/legacy-persistence';
    binaryResponse = new Blob([new Uint8Array(2 * 1024 * 1024)], {
      type: 'image/jpeg',
    });
    const stored = await storage.storeFile(source, { type: 'media' });
    expect(stored.result.code).toBe('SUCCESS');
    await storage.close();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    expect(await storage.retrieveFile(source)).toBe(stored.item!.url);
    expect(await storage.listFiles()).toEqual([stored.item]);
    expect(getAll).not.toHaveBeenCalled();
    if (commit) expect(commit).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('preserves committed payloads after a synchronous quota failure', async () => {
    const source = 'https://castmill.example/quota/channels';
    const first = await storage.storeFile(source, { type: 'data' });
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });
    response.text = '{"changed":true}';
    const second = await storage.storeFile(source, { type: 'data' });
    expect(second.result.code).toBe('FAILURE');
    await storage.close();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    expect(await storage.retrieveFile(source)).toBe(first.item!.url);
  });

  it('persists deletions and cache clearing across reopen without native payload writes', async () => {
    const first = 'https://castmill.example/clear/first';
    const second = 'https://castmill.example/clear/second';
    await storage.storeFile(first, { type: 'data' });
    await storage.storeFile(second, { type: 'data' });
    await storage.deleteFile(first);
    await storage.close();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    expect(await storage.retrieveFile(first)).toBeUndefined();
    expect(await storage.retrieveFile(second)).toMatch(/^data:/);
    await storage.deleteAllFiles();
    await storage.close();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    expect(await storage.listFiles()).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('uses a new local URI when the same source URL is rewritten', async () => {
    const url = 'https://castmill.example/media/image.png';

    const first = await storage.storeFile(url, { type: 'media' });
    const second = await storage.storeFile(url, { type: 'media' });

    expect(first.item?.url).not.toBe(second.item?.url);
    expect(downloadFile).toHaveBeenCalledTimes(2);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes a superseded local URI without removing the current mapping', async () => {
    const url = 'https://castmill.example/media/image.png';
    const first = await storage.storeFile(url, { type: 'media' });
    const second = await storage.storeFile(url, { type: 'media' });

    await storage.deleteFile(first.item!.url);

    expect(deleteFile).toHaveBeenCalledWith(first.item!.url);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes the native file and mapping when given its source URL', async () => {
    const url = 'https://castmill.example/media/image.png';
    const stored = await storage.storeFile(url, { type: 'media' });

    await storage.deleteFile(url);

    expect(deleteFile).toHaveBeenCalledWith(stored.item!.url);
    expect(await storage.retrieveFile(url)).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledWith('FILE_MAP');
  });

  it.each([
    'https://broker.images.castmill.io/listing/photo?w=1920&v=4',
    'http://media.example/uncached.jpg',
    'blob:http://player.example/temporary-image',
    'file:///data/data/com.optimalbits/files/unknown',
    'content://unrelated.provider/cache/photo',
    'content://com.optimalbits.fileprovider/other/photo',
    'content://com.optimalbits.fileprovider/cache/',
  ])(
    'does not send an unowned cache URL to the crashing native delete API: %s',
    async (url) => {
      await storage.deleteFile(url);
      expect(deleteFile).not.toHaveBeenCalled();
    }
  );

  it('evicts uncached broker metadata under capacity pressure without deleting a remote URL or another native file', async () => {
    const cache = new Cache(storage, 'legacy-broker-eviction', 2);
    const remote = 'https://broker.images.castmill.io/listing/photo?w=1920&v=4';
    const video = 'https://castmill.example/kept.mp4';
    try {
      await cache.init();
      const kept = await cache.set(video, ItemType.Media, 'video/mp4');
      await cache.items.put({
        url: remote,
        cachedUrl: remote,
        timestamp: 0,
        accessed: 0,
        size: 100,
        type: ItemType.Media,
        mimeType: 'image/jpeg',
      });
      await cache.set(
        'https://castmill.example/new/data',
        ItemType.Data,
        'application/json'
      );
      await cache.invalidate(remote);
      expect(await cache.get(remote)).toBeUndefined();
      expect(await storage.retrieveFile(video)).toBe(kept!.cachedUrl);
      expect(deleteFile).not.toHaveBeenCalled();
    } finally {
      cache.close();
    }
  });

  it('retains the mapping and reports a native cache-file deletion failure', async () => {
    const url = 'https://castmill.example/kept.mp4';
    const stored = await storage.storeFile(url, { type: 'media' });
    vi.mocked(deleteFile).mockRejectedValueOnce(
      new Error('native deletion failed')
    );
    await expect(storage.deleteFile(url)).rejects.toThrow(
      'native deletion failed'
    );
    expect(await storage.retrieveFile(url)).toBe(stored.item!.url);
  });

  it('removes a migrated remote mapping without sending its URL to native deletion', async () => {
    await storage.close();
    const source = 'https://broker.images.castmill.io/listing/photo';
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([[source, { url: source, size: 100 }]])
    );
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    await storage.deleteFile(source);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(await storage.retrieveFile(source)).toBeUndefined();
  });

  it('deletes stale mapped localhost files before replacing their mapping', async () => {
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([
        [
          'https://192.168.1.10/media/image.png',
          {
            url: 'content://com.optimalbits.fileprovider/cache/stale-file',
            size: 123,
          },
        ],
      ])
    );

    vi.stubEnv('VITE_FILE_HOST', '192.168.1.10');
    storage = new AndroidLegacyFileStorage('');
    await storage.init();

    try {
      await storage.storeFile('https://localhost/media/image.png', {
        type: 'media',
      });
      expect(deleteFile).toHaveBeenCalledWith(
        'content://com.optimalbits.fileprovider/cache/stale-file'
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('replaces a stale mapped data URL without passing it to native deletion', async () => {
    await storage.close();
    vi.mocked(getItem).mockResolvedValueOnce(
      JSON.stringify([
        [
          'https://192.168.1.10/media/image.png',
          {
            url: 'data:image/png;base64,AA==',
            size: 1,
          },
        ],
      ])
    );
    vi.stubEnv('VITE_FILE_HOST', '192.168.1.10');
    storage = new AndroidLegacyFileStorage('');
    try {
      await storage.init();
      const result = await storage.storeFile(
        'https://localhost/media/image.png',
        { type: 'media' }
      );
      expect(result.result.code).toBe('SUCCESS');
      expect(deleteFile).not.toHaveBeenCalled();
      expect(
        await storage.retrieveFile('https://localhost/media/image.png')
      ).toBe(result.item!.url);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('resets a malformed FILE_MAP and remains usable', async () => {
    vi.mocked(getItem).mockResolvedValueOnce('{not-json');
    storage = new AndroidLegacyFileStorage('');

    await expect(storage.init()).resolves.toBeUndefined();
    expect(JSON.parse(native.fileMap!)).toMatchObject({ version: 1 });

    const stored = await storage.storeFile(
      'https://castmill.example/media/recovered.png',
      { type: 'media' }
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
    expect(JSON.parse(native.fileMap!)).toMatchObject({ version: 1 });
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
    expect(JSON.parse(native.fileMap!)).toMatchObject({ version: 1 });
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
      storage.storeFile('https://castmill.example/media/movie.mp4', {
        type: 'media',
      })
    ).resolves.toEqual({
      result: {
        code: 'FAILURE',
        error: 'NOT_ENOUGH_SPACE',
        errMsg: '10000000',
      },
    });
  });

  it('deletes the complete storage path so orphan files are also removed', async () => {
    await storage.storeFile('https://castmill.example/media/first.png', {
      type: 'media',
    });
    await storage.storeFile('https://castmill.example/media/second.mp4', {
      type: 'media',
    });

    await storage.deleteAllFiles();

    expect(deletePath).toHaveBeenCalledWith('');
    expect(await storage.listFiles()).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each(['channels', 'automations'])(
    'loads authenticated %s with no Content-Length through Cache and ResourceManager',
    async (resource) => {
      const url = `https://castmill.example/devices/1/${resource}?version=1`;
      const payload = {
        data:
          resource === 'channels' ? [{ name: 'Lobby' }] : { automations: [] },
      };
      response.text = JSON.stringify(payload);
      const cache = new Cache(storage, `legacy-unknown-length-${resource}`, 10);
      const resources = new ResourceManager(cache, {
        authToken: 'test-token',
        authOrigins: ['https://castmill.example'],
      });

      try {
        await resources.init();
        await expect(resources.getData(url, 1000)).resolves.toEqual(payload);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe(url);
        expect(requests[0].headers).toEqual({
          Authorization: 'Bearer test-token',
        });
        expect(requests[0].getResponseHeader()).toBeNull();
        expect(downloadFile).not.toHaveBeenCalled();
        const saved = native.fileMap!;
        expect(saved).not.toContain('test-token');

        cache.close();
        vi.mocked(getItem).mockResolvedValueOnce(saved);
        const restored = new AndroidLegacyFileStorage('');
        const offlineCache = new Cache(
          restored,
          `legacy-unknown-length-${resource}`,
          10
        );
        const offlineResources = new ResourceManager(offlineCache, {
          authToken: 'test-token',
          authOrigins: ['https://castmill.example'],
        });
        try {
          await offlineResources.init();
          expect(fileExists).not.toHaveBeenCalled();
          response.event = 'error';
          await expect(offlineResources.getData(url, 0)).resolves.toEqual(
            payload
          );
          expect(downloadFile).not.toHaveBeenCalled();
        } finally {
          offlineCache.close();
        }
      } finally {
        cache.close();
      }
    }
  );

  it('stores code and counts UTF-8 bytes without a native download', async () => {
    const url = 'https://castmill.example/widgets/code.js';
    response.text = 'export const name = "Å";';
    const stored = await storage.storeFile(url, { type: 'code' });
    expect(stored.item?.url).toMatch(
      /^data:text\/javascript;charset=utf-8;castmill-revision=\d+,/
    );
    expect(stored.item?.size).toBe(new Blob([response.text]).size);
    expect(await (await fetch(stored.item!.url)).text()).toBe(response.text);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it.each([
    ['application/json', '{"data":[1]}'],
    ['text/javascript', 'export const text = "#12345";'],
  ])(
    'reads previously persisted %s fragment URLs on Crosswalk',
    async (mimeType, text) => {
      const oldUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(text)}#12345`;
      const response = await fetch(oldUrl);
      await expect(response.text()).resolves.toBe(text);
      expect(cachedReads[0]).toBe(
        `data:${mimeType};charset=utf-8;castmill-revision=12345,${encodeURIComponent(text)}`
      );
    }
  );

  it('removes persisted data URLs without calling native file deletion', async () => {
    const url = 'https://castmill.example/devices/1/channels';
    const first = await storage.storeFile(url, { type: 'data' });
    response.text = '{"data":[1]}';
    const second = await storage.storeFile(url, { type: 'data' });
    expect(first.item?.url).not.toBe(second.item?.url);

    await storage.deleteFile(first.item!.url);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
    await storage.deleteFile(second.item!.url);
    expect(await storage.retrieveFile(url)).toBeUndefined();
    expect(deleteFile).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('keeps distinct cache identities for resources with identical content', async () => {
    const channels = 'https://castmill.example/devices/1/channels';
    const automations = 'https://castmill.example/devices/1/automations';
    const first = await storage.storeFile(channels, { type: 'data' });
    const second = await storage.storeFile(automations, { type: 'data' });
    expect(first.item?.url).not.toBe(second.item?.url);
    await storage.deleteFile(first.item!.url);
    expect(await storage.retrieveFile(channels)).toBeUndefined();
    expect(await storage.retrieveFile(automations)).toBe(second.item?.url);
  });

  it('preserves concurrently downloaded configuration in IndexedDB without rewriting preferences', async () => {
    const channels = 'https://castmill.example/devices/1/channels';
    const automations = 'https://castmill.example/devices/1/automations';
    const first = storage.storeFile(channels, { type: 'data' });
    const second = storage.storeFile(automations, { type: 'data' });
    const stored = await Promise.all([first, second]);
    await storage.close();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    expect(await storage.retrieveFile(channels)).toBe(stored[0].item!.url);
    expect(await storage.retrieveFile(automations)).toBe(stored[1].item!.url);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('loads unknown-length configuration and reaches scheduled playback after registration', async () => {
    const baseUrl = 'https://castmill.example';
    const channelsUrl = `${baseUrl}/devices/1/channels`;
    const automationsUrl = `${baseUrl}/devices/1/automations`;
    const playlistUrl = `${baseUrl}/devices/1/playlists/12`;
    responses.set(
      channelsUrl,
      JSON.stringify({
        data: [{ name: 'Lobby', timezone: 'UTC', default_playlist_id: '12' }],
      })
    );
    responses.set(
      automationsUrl,
      JSON.stringify({
        data: {
          generated_at: Date.now(),
          valid_until: Date.now() + 86400000,
          automations: [],
        },
      })
    );
    responses.set(
      playlistUrl,
      JSON.stringify({
        id: 12,
        name: 'Lobby playlist',
        status: 'live',
        items: [],
      })
    );
    const machine = new BrowserMachine();
    vi.spyOn(machine, 'getCredentials').mockResolvedValue(
      JSON.stringify({
        device: { id: '1', name: 'Lobby', token: 'test-token' },
      })
    );
    const startupCache = new Cache(storage, 'legacy-startup-cache', 10);
    const device = new Device(machine, storage, { cacheBackend: startupCache });
    device['baseUrl'] = baseUrl;
    vi.spyOn(device['errorReporter'], 'init').mockResolvedValue(undefined);
    const play = vi.fn();
    device.on('ready', () => {
      vi.spyOn(device['player']!, 'play').mockImplementation(play);
    });

    try {
      const started = device.start(document.createElement('div'));
      await vi.waitFor(() => expect(play).toHaveBeenCalled(), {
        timeout: 2000,
      });
      await device['automationsLoad'];
      await device.stop();
      device['wakeProgramming']?.();
      await started;
      await vi.waitFor(() =>
        expect(device['automationsPayload']).toBeDefined()
      );
      expect(device['channels'][0].attrs.name).toBe('Lobby');
      expect(play).toHaveBeenCalledWith({ loop: true });
      for (const url of [channelsUrl, automationsUrl, playlistUrl]) {
        expect(
          requests.some(
            (request) =>
              request.method === 'GET' &&
              request.url === url &&
              request.headers.Authorization === 'Bearer test-token'
          )
        ).toBe(true);
      }
      expect(downloadFile).not.toHaveBeenCalled();
    } finally {
      await device.stop();
      device['cache'].close();
      vi.restoreAllMocks();
    }
  });

  it.each([401, 403, 206, 500])(
    'rejects HTTP %s instead of caching a response body',
    async (status) => {
      response.status = status;
      const stored = await storage.storeFile(
        'https://castmill.example/devices/1/channels',
        { type: 'data' }
      );
      expect(stored.result).toEqual({
        code: 'FAILURE',
        error: 'UNKNOWN',
        errMsg: `Configuration download failed: HTTP ${status}`,
      });
      expect(await storage.listFiles()).toEqual([]);
      expect(setItem).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it.each(['error', 'timeout', 'abort'])(
    'rejects a request %s without retaining data',
    async (event) => {
      response.event = event;
      const stored = await storage.storeFile(
        'https://castmill.example/devices/1/channels',
        { type: 'data' }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(requests[0].timeout).toBe(30_000);
      expect(await storage.listFiles()).toEqual([]);
    }
  );

  it.each(['bytes=0--2', 'bytes=-1-5', 'bytes=0-10'])(
    'rejects range %s before sending a full-file download',
    async (range) => {
      const stored = await storage.storeFile(
        'https://castmill.example/devices/1/channels',
        {
          type: 'data',
          headers: { rAnGe: range },
        }
      );
      expect(stored.result).toEqual({
        code: 'FAILURE',
        error: 'UNKNOWN',
        errMsg: 'Partial download ranges are not supported by the cache',
      });
      expect(requests).toHaveLength(0);
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it('keeps the prior configuration if persisting a replacement fails', async () => {
    const url = 'https://castmill.example/devices/1/channels';
    const first = await storage.storeFile(url, { type: 'data' });
    response.text = '{"data":[1]}';
    abortNextFileMapWrite();
    const second = await storage.storeFile(url, { type: 'data' });
    expect(second.result.code).toBe('FAILURE');
    expect(await storage.retrieveFile(url)).toBe(first.item?.url);
  });

  it('preserves existing query parameters when authenticating native media', async () => {
    await storage.storeFile(
      'https://castmill.example/media/movie.mp4?version=1#fragment',
      {
        type: 'media',
        headers: { Authorization: 'Bearer test-token' },
      }
    );
    expect(vi.mocked(downloadFile).mock.calls[0][0]).toBe(
      'https://castmill.example/media/movie.mp4?version=1&auth=Bearer%20test-token#fragment'
    );
  });

  it.each([
    [
      'https://cdn.castmill.example/fonts/Brandon-Medium.OTF?version=1',
      'font/otf',
    ],
    ['https://cdn.castmill.example/fonts/Brandon-Black.otf', 'font/otf'],
    ['https://broker.images.castmill.io/photo/123?width=800', 'image/jpeg'],
  ])(
    'persists unknown-length binary %s without HEAD or ranges',
    async (url, type) => {
      const bytes = [0, 255, 128, 35, 10, 195, 169];
      binaryResponse = new Blob([new Uint8Array(bytes)], { type });
      const stored = await storage.storeFile(url, {
        type: 'media',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(stored.result.code).toBe('SUCCESS');
      expect(stored.item?.size).toBe(bytes.length);
      expect(stored.item?.url).toMatch(
        new RegExp(`^data:${type};castmill-revision=\\d+;base64,`)
      );
      const base64 = stored.item!.url.split(',')[1];
      expect(Array.from(atob(base64), (char) => char.charCodeAt(0))).toEqual(
        bytes
      );
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        method: 'GET',
        url,
        responseType: 'blob',
        timeout: 30_000,
        headers: { Authorization: 'Bearer test-token' },
      });
      expect(downloadFile).not.toHaveBeenCalled();
      const saved = native.fileMap!;
      expect(saved).not.toContain('test-token');

      vi.mocked(getItem).mockResolvedValueOnce(saved);
      const restored = new AndroidLegacyFileStorage('');
      await restored.init();
      response.event = 'error';
      expect(await restored.retrieveFile(url)).toBe(stored.item?.url);
      expect(await restored.listFiles()).toEqual([stored.item]);
      expect(fileExists).not.toHaveBeenCalled();
    }
  );

  it('falls back from a failed native image without putting auth in the XHR URL', async () => {
    const url = 'https://cdn.castmill.example/13/poster.jpg?version=1';
    vi.mocked(downloadFile).mockRejectedValueOnce(
      new Error('too many failed download attempts')
    );
    binaryResponse = new Blob([new Uint8Array([0, 255])], {
      type: 'image/jpeg',
    });

    const stored = await storage.storeFile(url, {
      type: 'media',
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(stored.result.code).toBe('SUCCESS');
    expect(stored.item?.url).toMatch(/^data:image\/jpeg;/);
    expect(downloadFile).toHaveBeenCalledOnce();
    expect(requests[0].url).toBe(url);
    expect(requests[0].headers).toEqual({
      Authorization: 'Bearer test-token',
    });
  });

  it.each(['movie.mp4', 'unknown-resource'])(
    'does not turn a failed native %s into a persisted binary',
    async (path) => {
      vi.mocked(downloadFile).mockRejectedValueOnce(
        new Error('Native failure')
      );
      const stored = await storage.storeFile(
        `https://cdn.castmill.example/${path}`,
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(requests).toHaveLength(0);
      expect(setItem).not.toHaveBeenCalled();
    }
  );

  it('keeps native image disk exhaustion on the capacity-recovery path', async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce({ message: 'CacheFull' });
    const stored = await storage.storeFile(
      'https://cdn.castmill.example/14/poster.jpg',
      {
        type: 'media',
      }
    );
    expect(stored.result).toEqual({
      code: 'FAILURE',
      error: 'NOT_ENOUGH_SPACE',
      errMsg: '1000000',
    });
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['logo.PNG', '', 'image/png'],
    ['regular.ttf', 'application/octet-stream', 'font/ttf'],
    ['regular.woff', 'application/font-woff', 'application/font-woff'],
  ])(
    'preserves or infers the MIME type of %s',
    async (path, type, expectedType) => {
      vi.mocked(downloadFile).mockRejectedValueOnce(
        new Error('Native failure')
      );
      binaryResponse = new Blob(['binary'], { type });
      const stored = await storage.storeFile(
        `https://cdn.castmill.example/${path}`,
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('SUCCESS');
      expect(stored.item?.url.startsWith(`data:${expectedType};`)).toBe(true);
    }
  );

  it.each(['text/html', 'application/json', 'video/mp4', ''])(
    'rejects an unsupported broker response type %s',
    async (type) => {
      binaryResponse = new Blob(['not an image'], { type });
      const stored = await storage.storeFile(
        'https://broker.images.castmill.io/photo',
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(stored.result.errMsg).toBe(
        'Binary download failed: unsupported content type'
      );
      expect(setItem).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it.each([401, 403, 206, 500])(
    'rejects binary HTTP %s without persisting the response',
    async (status) => {
      response.status = status;
      binaryResponse = new Blob(['binary'], { type: 'font/otf' });
      const stored = await storage.storeFile(
        'https://cdn.castmill.example/font.otf',
        {
          type: 'media',
        }
      );
      expect(stored.result).toEqual({
        code: 'FAILURE',
        error: 'UNKNOWN',
        errMsg: `Binary download failed: HTTP ${status}`,
      });
      expect(setItem).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it.each(['error', 'timeout', 'abort'])(
    'reports binary request %s without trying the unsafe native downloader',
    async (event) => {
      response.event = event;
      const stored = await storage.storeFile(
        'https://cdn.castmill.example/font.otf',
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(requests[0].timeout).toBe(30_000);
      expect(setItem).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it.each([null, new Blob([], { type: 'font/otf' })])(
    'rejects an invalid or empty binary response',
    async (blob) => {
      binaryResponse = blob;
      const stored = await storage.storeFile(
        'https://cdn.castmill.example/font.otf',
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(setItem).not.toHaveBeenCalled();
    }
  );

  it('aborts an oversized chunked binary download without knowing its length', async () => {
    progressLoaded = 2 * 1024 * 1024 + 1;
    const stored = await storage.storeFile(
      'https://broker.images.castmill.io/photo',
      {
        type: 'media',
      }
    );
    expect(stored.result).toEqual({
      code: 'FAILURE',
      error: 'TOO_LARGE',
      errMsg: 'Binary asset exceeds the 2 MiB persistent cache limit',
    });
    expect(requests[0].aborted).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('checks actual binary size even when progress events are unavailable', async () => {
    binaryResponse = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], {
      type: 'font/otf',
    });
    const stored = await storage.storeFile(
      'https://cdn.castmill.example/font.otf',
      {
        type: 'media',
      }
    );
    expect(stored.result.error).toBe('TOO_LARGE');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('allows the per-file boundary and preserves revisions and deletion semantics', async () => {
    const url = 'https://broker.images.castmill.io/photo';
    binaryResponse = new Blob([new Uint8Array(2 * 1024 * 1024)], {
      type: 'image/jpeg',
    });
    const first = await storage.storeFile(url, { type: 'media' });
    const second = await storage.storeFile(url, { type: 'media' });
    expect(first.result.code).toBe('SUCCESS');
    expect(second.result.code).toBe('SUCCESS');
    expect(first.item?.url).not.toBe(second.item?.url);
    await storage.deleteFile(first.item!.url);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
    await storage.deleteFile(url);
    expect(await storage.retrieveFile(url)).toBeUndefined();
    expect(deleteFile).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('enforces the shared binary budget inside serialized map writes and permits replacements', async () => {
    const existing = Array.from({ length: 4 }, (_, index) => [
      `https://broker.images.castmill.io/${index}`,
      {
        url: `data:image/jpeg;castmill-revision=${index};base64,AA==`,
        size: 2 * 1024 * 1024 - (index === 3 ? 2 : 0),
      },
    ]);
    vi.mocked(getItem).mockResolvedValueOnce(JSON.stringify(existing));
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
    binaryResponse = new Blob([new Uint8Array([0, 1])], {
      type: 'image/jpeg',
    });
    const urls = [
      'https://broker.images.castmill.io/new-1',
      'https://broker.images.castmill.io/new-2',
    ];
    const results = await Promise.all(
      urls.map((url) => storage.storeFile(url, { type: 'media' }))
    );
    expect(
      results.filter((stored) => stored.result.code === 'SUCCESS')
    ).toHaveLength(1);
    expect(
      results
        .filter((stored) => stored.result.code === 'FAILURE')
        .map((stored) => stored.result)
    ).toMatchObject([
      { code: 'FAILURE', error: 'NOT_ENOUGH_SPACE', errMsg: '2' },
    ]);
    const failure = results.find((stored) => stored.result.code === 'FAILURE')!;
    expect(failure.result.evictableUrls).toHaveLength(5);
    expect(failure.result.evictableUrls).not.toContain(
      urls[results.indexOf(failure)]
    );
    expect(setItem).toHaveBeenCalledOnce();
    const replacement = await storage.storeFile(
      'https://broker.images.castmill.io/0',
      {
        type: 'media',
      }
    );
    expect(replacement.result.code).toBe('SUCCESS');
    const failedUrl =
      urls[results.findIndex((stored) => stored.result.code === 'FAILURE')];
    expect(await storage.retrieveFile(failedUrl)).toBeUndefined();
    const recovered = await storage.storeFile(failedUrl, { type: 'media' });
    expect(recovered.result.code).toBe('SUCCESS');
  });

  it('evicts only binary media through Cache and restores preserved video/code/data and the new image offline', async () => {
    const cacheName = 'legacy-binary-media-eviction';
    const cache = new Cache(storage, cacheName, 10);
    const resources = new ResourceManager(cache);
    const urls = Array.from(
      { length: 4 },
      (_, index) => `https://broker.images.castmill.io/cached-${index}`
    );
    const preserved = [
      {
        url: 'https://castmill.example/kept.mp4',
        type: ItemType.Media,
        mime: 'video/mp4',
      },
      {
        url: 'https://castmill.example/kept.js',
        type: ItemType.Code,
        mime: 'text/javascript',
      },
      {
        url: 'https://castmill.example/kept.json',
        type: ItemType.Data,
        mime: 'application/json',
      },
    ];
    const preservedUrls = new Map<string, string>();
    try {
      await resources.init();
      for (const { url, type, mime } of preserved) {
        const item = await cache.set(url, type, mime);
        preservedUrls.set(url, item!.cachedUrl);
        await cache.items.update(url, { timestamp: 0 });
      }
      binaryResponse = new Blob([new Uint8Array(2 * 1024 * 1024)], {
        type: 'image/jpeg',
      });
      for (const url of urls) {
        expect(await resources.getMedia(url)).toMatch(/^data:image\/jpeg;/);
      }
      binaryResponse = new Blob([new Uint8Array([255, 0, 128])], {
        type: 'image/jpeg',
      });
      const url = 'https://broker.images.castmill.io/new-image';
      const cachedUrl = await resources.getMedia(url);
      expect(cachedUrl).toMatch(/^data:image\/jpeg;/);
      expect(await cache.items.count()).toBe(7);
      expect(await storage.retrieveFile(urls[0])).toBeUndefined();
      expect(await cache.items.get(urls[0])).toBeUndefined();
      for (const [source, local] of preservedUrls) {
        expect(await storage.retrieveFile(source)).toBe(local);
        expect((await cache.items.get(source))!.cachedUrl).toBe(local);
      }
      expect(deleteFile).not.toHaveBeenCalled();
      const saved = native.fileMap!;
      cache.close();

      vi.mocked(getItem).mockResolvedValueOnce(saved);
      const restored = new AndroidLegacyFileStorage('');
      const offlineCache = new Cache(restored, cacheName, 10);
      const offlineResources = new ResourceManager(offlineCache);
      try {
        await offlineResources.init();
        response.event = 'error';
        const requestCount = requests.length;
        expect(await offlineResources.getMedia(url)).toBe(cachedUrl);
        expect(requests).toHaveLength(requestCount);
        expect(await restored.retrieveFile(url)).toBe(cachedUrl);
        for (const [source, local] of preservedUrls) {
          expect(await restored.retrieveFile(source)).toBe(local);
          expect((await offlineCache.items.get(source))!.cachedUrl).toBe(local);
        }
        expect(downloadFile).toHaveBeenCalledOnce();
        expect(deleteFile).not.toHaveBeenCalled();
      } finally {
        offlineCache.close();
      }
    } finally {
      cache.close();
    }
  });

  it('retains the prior binary mapping if persistence fails', async () => {
    const url = 'https://broker.images.castmill.io/photo';
    binaryResponse = new Blob(['first'], { type: 'image/jpeg' });
    const first = await storage.storeFile(url, { type: 'media' });
    binaryResponse = new Blob(['second'], { type: 'image/jpeg' });
    abortNextFileMapWrite();
    const second = await storage.storeFile(url, { type: 'media' });
    expect(second.result.code).toBe('FAILURE');
    expect(await storage.retrieveFile(url)).toBe(first.item?.url);
  });

  it.each(['error', 'abort', 'invalid'])(
    'reports binary encoding %s without persisting an unusable URL',
    async (event) => {
      vi.stubGlobal(
        'FileReader',
        class {
          result = null;
          onload?: () => void;
          onerror?: () => void;
          onabort?: () => void;
          readAsDataURL() {
            if (event === 'error') this.onerror?.();
            else if (event === 'abort') this.onabort?.();
            else this.onload?.();
          }
        }
      );
      binaryResponse = new Blob(['binary'], { type: 'font/otf' });
      const stored = await storage.storeFile(
        'https://cdn.castmill.example/font.otf',
        {
          type: 'media',
        }
      );
      expect(stored.result.code).toBe('FAILURE');
      expect(stored.result.errMsg).toMatch(/^Binary encoding failed:/);
      expect(setItem).not.toHaveBeenCalled();
    }
  );

  it('rejects binary Range headers before sending either downloader', async () => {
    const stored = await storage.storeFile(
      'https://broker.images.castmill.io/photo',
      {
        type: 'media',
        headers: { rAnGe: 'bytes=0-31' },
      }
    );
    expect(stored.result.code).toBe('FAILURE');
    expect(requests).toHaveLength(0);
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
