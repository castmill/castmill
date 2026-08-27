import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authFetch } from './auth-fetch';

describe('authFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock;
    localStorage.removeItem('castmill_auth_token');
  });

  afterEach(() => {
    localStorage.removeItem('castmill_auth_token');
    vi.restoreAllMocks();
  });

  it('adds Authorization: Bearer header when token exists in localStorage', async () => {
    localStorage.setItem('castmill_auth_token', 'test-jwt-token');

    await authFetch('http://api.test/endpoint');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, opts] = fetchMock.mock.calls[0];
    const headers = new Headers(opts.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
  });

  it('does not add Authorization header when no token is stored', async () => {
    await authFetch('http://api.test/endpoint');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/endpoint');
    // Without a token the original init is forwarded as-is (no headers injected)
    const headers = new Headers(opts?.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('preserves an explicitly provided Authorization header', async () => {
    localStorage.setItem('castmill_auth_token', 'should-not-replace');

    await authFetch('http://api.test/endpoint', {
      headers: { Authorization: 'Bearer explicit-token' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, opts] = fetchMock.mock.calls[0];
    const headers = new Headers(opts.headers);
    expect(headers.get('Authorization')).toBe('Bearer explicit-token');
  });

  it('forwards other init options alongside the injected header', async () => {
    localStorage.setItem('castmill_auth_token', 'abc');

    await authFetch('http://api.test/endpoint', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ key: 'value' }));
    const headers = new Headers(opts.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer abc');
  });

  it('passes through init unchanged when no token and init is provided', async () => {
    await authFetch('http://api.test/endpoint', {
      method: 'DELETE',
      headers: { 'X-Custom': 'yes' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('DELETE');
    const headers = new Headers(opts.headers);
    expect(headers.get('X-Custom')).toBe('yes');
    expect(headers.get('Authorization')).toBeNull();
  });

  it('passes empty object as init when no token and no init given', async () => {
    await authFetch('http://api.test/endpoint');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/endpoint');
    expect(opts).toEqual({});
  });
});
