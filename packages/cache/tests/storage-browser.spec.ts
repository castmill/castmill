import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageBrowser } from '../src/integrations/browser/storage-browser';

describe('StorageBrowser service worker registration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('can use Cache Storage without creating its own registration', async () => {
    const register = vi.fn();
    const getRegistration = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        getRegistration,
      },
    });
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({}),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await new StorageBrowser('file-cache', '', false).init();

    expect(register).not.toHaveBeenCalled();
    expect(getRegistration).not.toHaveBeenCalled();
    expect(caches.open).toHaveBeenCalledWith('castmill:storage:file-cache');
  });

  it('keeps service worker registration enabled by default', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        getRegistration: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({}),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await new StorageBrowser('browser-cache', '/assets/').init();

    expect(register).toHaveBeenCalledWith('/assets/sw.js');
  });

  it('registers the worker with an explicit scope and updates that registration', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    const update = vi.fn().mockResolvedValue(undefined);
    const getRegistration = vi.fn().mockResolvedValue({ update });
    vi.stubGlobal('navigator', {
      serviceWorker: { register, getRegistration },
    });
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({}),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await new StorageBrowser('browser-cache', '/assets/', true, '/').init();

    expect(register).toHaveBeenCalledWith('/assets/sw.js', { scope: '/' });
    expect(getRegistration).toHaveBeenCalledWith('/');
    expect(update).toHaveBeenCalledOnce();
  });

  it('does not fail initialization when an outdated worker cannot update', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue({ scope: '/' }),
        getRegistration: vi.fn().mockResolvedValue({
          update: vi.fn().mockRejectedValue(new TypeError('404')),
        }),
      },
    });
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({}),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await expect(
      new StorageBrowser('browser-cache', '/assets/', true, '/').init()
    ).resolves.toBeUndefined();
  });

  it('opens Cache Storage when service workers are unavailable', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({}),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await new StorageBrowser('file-cache', '', false).init();
    expect(caches.open).toHaveBeenCalledWith('castmill:storage:file-cache');
  });

  it('reports when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(
      new StorageBrowser('file-cache', '', false).init()
    ).rejects.toThrow('Cache Storage is unavailable');
  });
});

describe('StorageBrowser.storeFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('revalidates with the network so service workers do not re-store stale data', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    // Players may replace window.fetch with a string-only polyfill.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        add,
        match: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
      }),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });
    const storage = new StorageBrowser('file-cache', '', false);
    await storage.init();

    const result = await storage.storeFile('https://api.example.com/data', {
      headers: { Authorization: 'Bearer token' },
    });

    expect(result.result.code).toBe('SUCCESS');
    const request: Request = add.mock.calls[0][0];
    expect(request.url).toBe('https://api.example.com/data');
    expect(request.cache).toBe('no-cache');
    expect(request.headers.get('Authorization')).toBe('Bearer token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a failure when the refresh cannot be stored', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        add: vi.fn().mockRejectedValue(new TypeError('Network error')),
        match: vi.fn(),
      }),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new StorageBrowser('file-cache', '', false);
    await storage.init();

    const result = await storage.storeFile('https://api.example.com/data');

    expect(result.result.code).toBe('FAILURE');
  });
});
