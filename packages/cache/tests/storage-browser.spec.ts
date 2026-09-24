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
