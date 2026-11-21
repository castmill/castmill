import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache, ItemType, ResourceManager } from '@castmill/cache';
import { BrowserMachine, Device } from '@castmill/device';
import { AndroidLegacyFileStorage } from './android-legacy-file-storage';
import '../polyfills/fetch';

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

const requests: MockXHR[] = [];
let response = { status: 200, text: '{"data":[]}', event: 'load' };
const responses = new Map<string, string>();
const cachedReads: string[] = [];

class MockXHR {
  method = '';
  url = '';
  headers: Record<string, string> = {};
  timeout = 0;
  status = 0;
  responseText = '';
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
    requests.length = 0;
    responses.clear();
    cachedReads.length = 0;
    response = { status: 200, text: '{"data":[]}', event: 'load' };
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      await storage.storeFile('https://localhost/media/image.png', {
        type: 'media',
      });
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
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
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
        const saved = vi.mocked(setItem).mock.calls.at(-1)![1];
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
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
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

  it('preserves concurrently downloaded configuration in the persisted map', async () => {
    let finishWrite!: () => void;
    vi.mocked(setItem).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    const channels = 'https://castmill.example/devices/1/channels';
    const automations = 'https://castmill.example/devices/1/automations';
    const first = storage.storeFile(channels, { type: 'data' });
    const second = storage.storeFile(automations, { type: 'data' });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalledOnce());
    finishWrite();
    const stored = await Promise.all([first, second]);
    const saved = JSON.parse(vi.mocked(setItem).mock.calls.at(-1)![1]);
    expect(saved).toEqual([
      [channels, stored[0].item],
      [automations, stored[1].item],
    ]);
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
    vi.mocked(setItem).mockRejectedValueOnce(new Error('Storage write failed'));
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
});
