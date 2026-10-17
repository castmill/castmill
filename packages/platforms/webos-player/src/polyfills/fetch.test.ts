import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockXHR {
  static last: MockXHR;
  status = 200;
  statusText = 'OK';
  responseText = '{"ok":true}';
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  headers: Record<string, string> = { 'content-type': 'application/json' };
  getResponseHeader = vi.fn(
    (name: string) => this.headers[name.toLowerCase()] ?? null
  );
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() {
    MockXHR.last = this;
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('XMLHttpRequest', MockXHR);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const install = async () => {
  vi.stubGlobal('fetch', undefined);
  await import('./fetch');
};

describe('Legacy WebOS fetch fallback', () => {
  it('preserves an available native fetch', async () => {
    const native = vi.fn();
    vi.stubGlobal('fetch', native);
    await import('./fetch');
    expect(window.fetch).toBe(native);
  });

  it('downloads authenticated data without logging URLs, headers or bodies', async () => {
    await install();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = fetch('https://api.test/data?token=private', {
      method: 'POST',
      headers: { Authorization: 'private-token' },
      body: 'private-body',
    });
    expect(MockXHR.last.open).toHaveBeenCalledWith(
      'POST',
      'https://api.test/data?token=private'
    );
    expect(MockXHR.last.setRequestHeader).toHaveBeenCalledWith(
      'Authorization',
      'private-token'
    );
    expect(MockXHR.last.send).toHaveBeenCalledWith('private-body');
    MockXHR.last.onload?.();
    const result = await response;
    expect(result.ok).toBe(true);
    expect(await result.json()).toEqual({ ok: true });
    expect(await result.text()).toBe('{"ok":true}');
    expect(log).not.toHaveBeenCalled();
  });

  it('supports a plain GET without options', async () => {
    await install();
    const result = fetch('blob:resource');
    expect(MockXHR.last.open).toHaveBeenCalledWith('GET', 'blob:resource');
    expect(MockXHR.last.send).toHaveBeenCalledWith();
    MockXHR.last.onload?.();
    expect((await result).status).toBe(200);
  });

  it.each([199, 300, 403, 500])(
    'resolves HTTP %s with ok=false like fetch',
    async (status) => {
      await install();
      const result = fetch('https://api.test/data');
      MockXHR.last.status = status;
      MockXHR.last.responseText = '{"error":"recovery_blocked"}';
      MockXHR.last.onload?.();
      const response = await result;
      expect(response.ok).toBe(false);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: 'recovery_blocked' });
    }
  );

  it('exposes response headers', async () => {
    await install();
    const result = fetch('https://api.test/data');
    MockXHR.last.onload?.();
    const response = await result;
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.has('etag')).toBe(false);
    expect(response.url).toBe('https://api.test/data');
  });

  it.each([
    ['Headers', () => new Headers({ 'X-Test': 'one' })],
    ['pairs', () => [['X-Test', 'one']] as [string, string][]],
  ])('sends %s headers', async (_name, headers) => {
    await install();
    void fetch('https://api.test/data', { headers: headers() });
    expect(MockXHR.last.setRequestHeader).toHaveBeenCalledWith(
      expect.stringMatching(/^x-test$/i),
      'one'
    );
  });

  it.each([
    ['onerror', 'Network request failed'],
    ['ontimeout', 'Network request timed out'],
    ['onabort', 'Aborted'],
  ] as const)('surfaces %s', async (event, message) => {
    await install();
    const result = fetch('https://api.test/data');
    MockXHR.last[event]?.();
    await expect(result).rejects.toThrow(message);
  });

  it('accepts URL objects', async () => {
    await install();
    void fetch(new URL('https://api.test/data'));
    expect(MockXHR.last.open).toHaveBeenCalledWith(
      'GET',
      'https://api.test/data'
    );
  });

  it('rejects Request objects asynchronously', async () => {
    await install();
    await expect(fetch(new Request('https://api.test/data'))).rejects.toThrow(
      'Request objects are unsupported'
    );
  });
});
