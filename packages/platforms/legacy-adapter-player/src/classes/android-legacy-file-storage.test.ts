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
let binaryResponse: Blob | null = null;
let progressLoaded = 0;

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
    requests.length = 0;
    responses.clear();
    cachedReads.length = 0;
    response = { status: 200, text: '{"data":[]}', event: 'load' };
    binaryResponse = null;
    progressLoaded = 0;
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
      const saved = vi.mocked(setItem).mock.calls.at(-1)![1];
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
    ).toEqual([{ code: 'FAILURE', error: 'NOT_ENOUGH_SPACE', errMsg: '2' }]);
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

  it('evicts old binary media through Cache and restores the new image offline through ResourceManager', async () => {
    const cacheName = 'legacy-binary-media-eviction';
    const cache = new Cache(storage, cacheName, 10);
    const resources = new ResourceManager(cache);
    const urls = Array.from(
      { length: 4 },
      (_, index) => `https://broker.images.castmill.io/cached-${index}`
    );
    try {
      await resources.init();
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
      expect(await cache.items.count()).toBe(4);
      expect(await storage.retrieveFile(urls[0])).toBeUndefined();
      const saved = vi.mocked(setItem).mock.calls.at(-1)![1];
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
        expect(downloadFile).not.toHaveBeenCalled();
        expect(fileExists).not.toHaveBeenCalled();
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
    vi.mocked(setItem).mockRejectedValueOnce(new Error('Storage write failed'));
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
