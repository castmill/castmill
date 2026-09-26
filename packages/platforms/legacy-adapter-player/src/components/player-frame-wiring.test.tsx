import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { Device, mountDevice } from '@castmill/device';
import { MemoryCache } from '@castmill/cache';
import { PlayerFrame } from './player-frame';
import { WebosWebSocket } from '../webos-legacy-api';
import { createWebosVideoPlayback } from '../classes/webos-video-playback';

const { makeDevice, initWebos, notifyWebos, initCache } = vi.hoisted(() => ({
  makeDevice: vi.fn(),
  initWebos: vi.fn(),
  notifyWebos: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@castmill/device', () => ({
  Device: makeDevice,
  BrowserMachine: class {},
  mountDevice: vi.fn(),
}));
vi.mock('../classes', () => {
  class Machine {
    initLegacy() {}
    getDeviceInfo = vi.fn().mockResolvedValue({
      appType: 'Legacy player',
      appVersion: '1.0.0',
      os: 'webOS',
      hardware: 'LG signage',
      chromiumVersion: '38.0.2125.122',
    });
    getTimezone = vi.fn().mockResolvedValue('Europe/Stockholm');
  }
  class Storage {
    init = initCache;
  }
  class WebosMachine extends Machine {
    initLegacy = initWebos;
    notifyReady = notifyWebos;
  }
  return {
    WebosLegacyMachine: WebosMachine,
    AndroidLegacyMachine: Machine,
    ElectronLegacyMachine: Machine,
    WebosLegacyFileStorage: Storage,
    AndroidLegacyFileStorage: Storage,
  };
});
vi.mock('@castmill/cache', () => ({
  MemoryCache: class {
    constructor(readonly storage: unknown) {}
  },
  StorageBrowser: class {
    async init() {}
  },
}));
beforeEach(() => {
  makeDevice.mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    id: 'device-42',
    name: 'Lobby Player',
    getServerConnectionStatus: () => 'connected',
    refreshIdentity: vi
      .fn()
      .mockResolvedValue({ id: 'device-42', name: 'Lobby Player' }),
    getOrganizationName: vi.fn().mockResolvedValue('Castmill AB'),
    getCastmillNetworkName: vi.fn().mockResolvedValue('Stockholm'),
    on: vi.fn(),
    off: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  initCache.mockResolvedValue(undefined);
});

describe('PlayerFrame playback controller selection', () => {
  it.each([
    ['Web0S', true],
    ['webOS', true],
    ['Android 5.1', false],
    ['Electron/29', false],
    ['Mozilla browser', false],
  ])('selects an override only for WebOS: %s', async (userAgent, webos) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    render(() => <PlayerFrame />);
    await waitFor(() => expect(mountDevice).toHaveBeenCalledOnce());
    expect(vi.mocked(Device).mock.calls[0][2]).toEqual(
      webos
        ? {
            transport: WebosWebSocket,
            createVideoPlaybackController: createWebosVideoPlayback,
            cacheBackend: expect.any(MemoryCache),
          }
        : undefined
    );
  });

  it('mounts and toggles the WebOS debug shell before post-mount state updates', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('webOS');
    render(() => <PlayerFrame />);

    const overlay = screen.getByLabelText('Player diagnostics');
    expect(overlay).toHaveStyle({ display: 'none' });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'file://com.lg.app.signage',
        source: window.parent,
      })
    );

    expect(overlay).toHaveStyle({ display: 'block' });
    await waitFor(() => expect(notifyWebos).toHaveBeenCalledOnce());
    await waitFor(() => {
      expect(overlay).toHaveTextContent('Organization: Castmill AB');
      expect(overlay).toHaveTextContent('Operating system: webOS');
      expect(overlay).toHaveTextContent('Chromium version: 38.0.2125.122');
    });
  });

  it('starts WebOS notifications before cache initialization and signals readiness after mount', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('webOS');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('sv-SE');
    let resolveCache!: () => void;
    initCache.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCache = resolve;
      })
    );
    render(() => <PlayerFrame />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Initializing player...'
    );
    await waitFor(() => expect(initCache).toHaveBeenCalledOnce());
    expect(initWebos).toHaveBeenCalledOnce();
    expect(notifyWebos).not.toHaveBeenCalled();
    expect(mountDevice).not.toHaveBeenCalled();

    const overlay = screen.getByRole('status');
    resolveCache();
    await waitFor(() => expect(mountDevice).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(overlay).toHaveStyle({ display: 'none' });
    expect(notifyWebos).toHaveBeenCalledOnce();
    expect(initWebos.mock.invocationCallOrder[0]).toBeLessThan(
      initCache.mock.invocationCallOrder[0]
    );
    expect(vi.mocked(mountDevice).mock.invocationCallOrder[0]).toBeLessThan(
      notifyWebos.mock.invocationCallOrder[0]
    );
  });

  it('shows cache initialization failures instead of a blank screen', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('webOS');
    initCache.mockRejectedValueOnce(new Error('Cache unavailable'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(() => <PlayerFrame />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cache unavailable'
    );
    expect(mountDevice).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Legacy adapter initialization failed during cache initialization',
      expect.any(Error),
      expect.any(String)
    );
  });
});
