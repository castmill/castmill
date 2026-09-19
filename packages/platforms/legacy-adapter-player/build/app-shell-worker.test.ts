import { describe, expect, it, vi } from 'vitest';
import { createAppShellWorker } from './app-shell-worker';

const files = [
  { fileName: 'index.html', contents: '<script src="assets/app.js"></script>' },
  { fileName: 'assets/app.js', contents: 'console.log("app");' },
  { fileName: 'assets/polyfills.js', contents: 'console.log("polyfills");' },
  { fileName: 'assets/app.js.map', contents: '{}' },
];

interface WorkerEvent {
  request?: Request;
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (operation: Promise<unknown>) => void;
}

const loadWorker = () => {
  const listeners: Record<string, (event: WorkerEvent) => void> = {};
  const shellEntries = new Map<string, Response>();
  const resourceEntries = new Map<string, Response>();
  const shellCache = {
    put: vi.fn(async (url: string, response: Response) => {
      shellEntries.set(url, response);
    }),
    match: vi.fn(async (request: Request | string) => {
      const url =
        typeof request === 'string' ? request : new URL(request.url).pathname;
      return shellEntries.get(url);
    }),
  };
  const caches = {
    open: vi.fn(async () => shellCache),
    keys: vi.fn(async () => [
      'castmill-legacy-shell-oldest',
      'castmill-legacy-shell-previous',
      'castmill:storage:file-cache',
    ]),
    delete: vi.fn(async () => true),
    match: vi.fn(async (request: Request) => resourceEntries.get(request.url)),
  };
  const self = {
    location: { origin: 'https://player.example.com' },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: vi.fn(
      (type: string, listener: (event: WorkerEvent) => void) => {
        listeners[type] = listener;
      }
    ),
  };
  const fetch = vi.fn(async (request: Request | string) => {
    const url = typeof request === 'string' ? request : request.url;
    return new Response(url);
  });
  const source = createAppShellWorker({ base: '/legacy/', files });

  new Function('self', 'caches', 'fetch', 'URL', source)(
    self,
    caches,
    fetch,
    URL
  );

  return {
    caches,
    fetch,
    listeners,
    resourceEntries,
    shellCache,
    source,
    workerGlobal: self,
  };
};

describe('createAppShellWorker', () => {
  it('generates a deterministic manifest for the complete shell', () => {
    const first = createAppShellWorker({ base: '/legacy/', files });
    const second = createAppShellWorker({
      base: '/legacy/',
      files: [...files].reverse(),
    });

    expect(first).toBe(second);
    expect(first).toContain('"/legacy/index.html"');
    expect(first).toContain('"/legacy/assets/app.js"');
    expect(first).toContain('"/legacy/assets/polyfills.js"');
    expect(first).not.toContain('app.js.map');
    expect(first).not.toMatch(/\basync\b/);
  });

  it('fails installation when the complete release cannot be cached', async () => {
    const { fetch, listeners, workerGlobal } = loadWorker();
    const installError = new Error('missing asset');
    fetch.mockRejectedValueOnce(installError);
    let installation: Promise<unknown> | undefined;

    listeners.install({
      waitUntil: (promise: Promise<unknown>) => {
        installation = promise;
      },
    });

    await expect(installation).rejects.toBe(installError);
    expect(workerGlobal.skipWaiting).not.toHaveBeenCalled();
  });

  it('activates an update only after the complete release is cached', async () => {
    const { listeners, shellCache, workerGlobal } = loadWorker();
    let installation: Promise<unknown> | undefined;

    listeners.install({
      waitUntil: (promise: Promise<unknown>) => {
        installation = promise;
      },
    });

    await installation;
    expect(shellCache.put).toHaveBeenCalledTimes(3);
    expect(workerGlobal.skipWaiting).toHaveBeenCalledOnce();
  });

  it('serves the cached index for the canonical legacy navigation', async () => {
    const { listeners, shellCache } = loadWorker();
    const cachedIndex = new Response('cached index');
    shellCache.match.mockResolvedValueOnce(cachedIndex);
    let response: Promise<Response> | undefined;

    listeners.fetch({
      request: new Request('https://player.example.com/legacy', {
        headers: { Accept: 'text/html' },
      }),
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });

    await expect(response).resolves.toBe(cachedIndex);
  });

  it('preserves resource caches and only removes old shell caches', async () => {
    const { caches, listeners } = loadWorker();
    let activation: Promise<unknown> | undefined;

    listeners.activate({
      waitUntil: (promise: Promise<unknown>) => {
        activation = promise;
      },
    });
    await activation;

    expect(caches.delete).toHaveBeenCalledTimes(1);
    expect(caches.delete).toHaveBeenCalledWith('castmill-legacy-shell-oldest');
    expect(caches.delete).not.toHaveBeenCalledWith(
      'castmill-legacy-shell-previous'
    );
    expect(caches.delete).not.toHaveBeenCalledWith(
      'castmill:storage:file-cache'
    );
  });

  it('serves cross-origin resources from StorageBrowser caches', async () => {
    const { listeners, resourceEntries } = loadWorker();
    const request = new Request('https://media.example.com/video.mp4');
    const cachedMedia = new Response('cached media');
    resourceEntries.set(request.url, cachedMedia);
    let response: Promise<Response> | undefined;

    listeners.fetch({
      request,
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });

    await expect(response).resolves.toBe(cachedMedia);
  });

  it('falls back to the previous release cache for a missing shell file', async () => {
    const { listeners, resourceEntries, shellCache } = loadWorker();
    const request = new Request(
      'https://player.example.com/legacy/assets/app.js'
    );
    const previousRelease = new Response('previous release');
    resourceEntries.set(request.url, previousRelease);
    shellCache.match.mockResolvedValueOnce(undefined);
    let response: Promise<Response> | undefined;

    listeners.fetch({
      request,
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });

    await expect(response).resolves.toBe(previousRelease);
  });
});
