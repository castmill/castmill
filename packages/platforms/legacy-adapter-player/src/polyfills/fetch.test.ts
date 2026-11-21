import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockXHR {
  static last: MockXHR;
  url = '';
  method = '';
  status = 200;
  responseText = '';
  headers: Record<string, string> = {};
  onload?: () => void;

  constructor() {
    MockXHR.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send() {
    this.responseText = this.url.startsWith('data:')
      ? decodeURIComponent(this.url.slice(this.url.indexOf(',') + 1))
      : '{"data":[]}';
    this.onload?.();
  }
}

describe('legacy fetch cached data URLs', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    vi.stubGlobal('fetch', vi.fn());
    await import('./fetch');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads JSON written with the old fragment revision on Crosswalk', async () => {
    const body = '{"data":[{"text":"#12345 Å"}]}';
    const response = await fetch(
      `data:application/json;charset=utf-8,${encodeURIComponent(body)}#9876`
    );
    await expect(response.json()).resolves.toEqual(JSON.parse(body));
  });

  it.each([
    'data:application/json;charset=utf-8;castmill-revision=9876,%7B%7D',
    'data:application/json;charset=utf-8,%7B%7D',
    'data:text/javascript,//#12345',
    'content://com.optimalbits.fileprovider/cache/file.json',
    'https://castmill.example/resource?version=1#9876',
  ])('does not rewrite other resource URLs: %s', async (url) => {
    await fetch(url);
    expect(MockXHR.last.url).toBe(url);
  });

  it('preserves method and authentication for HTTP configuration requests', async () => {
    const url = 'https://castmill.example/devices/1/channels';
    await fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(MockXHR.last.url).toBe(url);
    expect(MockXHR.last.method).toBe('GET');
    expect(MockXHR.last.headers).toEqual({
      Authorization: 'Bearer test-token',
    });
  });
});
