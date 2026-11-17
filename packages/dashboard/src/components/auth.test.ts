import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes authFetch on the store without calling it', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null));
    vi.resetModules();

    const { authFetch } = await import('./auth');
    const { store } = await import('../store');

    expect(store.authFetch).toBe(authFetch);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
