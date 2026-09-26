import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebosMemoryFileStorage } from './webos-memory-file-storage';

const requests: Array<{
  url: string;
  headers: Record<string, string>;
  xhr: MockXHR;
}> = [];

class MockXHR {
  status = 200;
  response: Blob | undefined;
  responseType = '';
  timeout = 0;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  private url = '';
  private headers: Record<string, string> = {};

  open(_method: string, url: string) {
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send() {
    requests.push({ url: this.url, headers: this.headers, xhr: this });
  }
}

describe('WebosMemoryFileStorage', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  let storage: WebosMemoryFileStorage;

  beforeEach(() => {
    requests.length = 0;
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second');
    class TestURL extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal('URL', TestURL);
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    vi.stubGlobal('indexedDB', undefined);
    storage = new WebosMemoryFileStorage();
  });

  afterEach(async () => {
    await storage.close();
    vi.unstubAllGlobals();
  });

  it('keeps authenticated code in memory and releases replaced blob URLs', async () => {
    const url = 'https://castmill.test/widgets/code.js';
    const first = storage.storeFile(url, {
      headers: { Authorization: 'Bearer secret' },
    });
    expect(requests[0].headers).toEqual({
      Authorization: 'Bearer secret',
    });
    expect(requests[0].url).toBe(url);
    expect(requests[0].xhr.responseType).toBe('blob');
    requests[0].xhr.response = new Blob(['first']);
    requests[0].xhr.onload?.();
    expect((await first).item?.url).toBe('blob:first');

    const second = storage.storeFile(url);
    requests[1].xhr.response = new Blob(['second']);
    requests[1].xhr.onload?.();
    expect((await second).item?.url).toBe('blob:second');
    expect(await storage.retrieveFile(url)).toBe('blob:second');
    await storage.deleteFile('blob:first');
    expect(await storage.retrieveFile(url)).toBe('blob:second');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
    await storage.deleteAllFiles();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second');
    expect(await storage.listFiles()).toEqual([]);
  });

  it('does not add an entry if the download fails', async () => {
    const url = 'https://castmill.test/data';
    const download = storage.storeFile(url);
    requests[0].xhr.onerror?.();
    await expect(download).rejects.toThrow(
      'Failed to download resource: network error'
    );
    expect(await storage.listFiles()).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('times out stalled downloads without retaining a cache entry', async () => {
    const download = storage.storeFile('https://castmill.test/data');
    expect(requests[0].xhr.timeout).toBe(30_000);
    requests[0].xhr.ontimeout?.();
    await expect(download).rejects.toThrow(
      'Failed to download resource: request timed out'
    );
    expect(await storage.listFiles()).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('does not expose signed URLs when a download returns an HTTP error', async () => {
    const download = storage.storeFile(
      'https://castmill.test/medias/image.png?token=secret'
    );
    requests[0].xhr.status = 403;
    requests[0].xhr.onload?.();
    await expect(download).rejects.toThrow(
      'Failed to download resource: HTTP 403'
    );
    expect(await storage.listFiles()).toEqual([]);
  });
});
