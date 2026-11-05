import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLegacyServiceWorkerConfig,
  registerLegacyAppShell,
} from './app-shell';

describe('legacy app shell registration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a scope that controls /legacy without a trailing slash', () => {
    expect(
      getLegacyServiceWorkerConfig({ pathname: '/legacy' } as Location)
    ).toEqual({
      scriptUrl: '/legacy/sw.js',
      scope: '/legacy',
    });
  });

  it('registers the worker on a secure legacy origin', async () => {
    const registration = {} as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const browserNavigator = {
      serviceWorker: { register },
    } as unknown as Navigator;
    const location = {
      hostname: 'player.example.com',
      pathname: '/legacy',
      protocol: 'https:',
    } as Location;

    await expect(
      registerLegacyAppShell(browserNavigator, location, true)
    ).resolves.toBe(registration);
    expect(register).toHaveBeenCalledWith('/legacy/sw.js', {
      scope: '/legacy',
    });
  });

  it('does not register on an insecure non-local origin', async () => {
    const register = vi.fn();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const browserNavigator = {
      serviceWorker: { register },
    } as unknown as Navigator;
    const location = {
      hostname: 'player.example.com',
      pathname: '/legacy',
      protocol: 'http:',
    } as Location;

    await expect(
      registerLegacyAppShell(browserNavigator, location, false)
    ).resolves.toBeUndefined();
    expect(register).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      '[LegacyAppShell] A secure HTTPS origin is required for offline startup.'
    );
  });

  it('reports installation failures without blocking online startup', async () => {
    const failure = new Error('registration failed');
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const browserNavigator = {
      serviceWorker: { register: vi.fn().mockRejectedValue(failure) },
    } as unknown as Navigator;
    const location = {
      hostname: 'player.example.com',
      pathname: '/legacy',
      protocol: 'https:',
    } as Location;

    await expect(
      registerLegacyAppShell(browserNavigator, location, true)
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      '[LegacyAppShell] Failed to install the offline application shell.',
      failure
    );
  });
});
