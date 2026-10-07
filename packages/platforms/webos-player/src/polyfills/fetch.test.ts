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

  it.each([199, 300])('rejects HTTP %s', async (status) => {
    await install();
    const result = fetch('https://api.test/data');
    MockXHR.last.status = status;
    MockXHR.last.onload?.();
    await expect(result).rejects.toThrow(`HTTP request failed: ${status}`);
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

  it('explicitly rejects unsupported URL objects', async () => {
    await install();
    expect(() => fetch(new URL('https://api.test'))).toThrow(
      'input is not a string'
    );
  });
});
