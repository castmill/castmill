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
vi.mock('./legacy-debug-overlay', () => ({ LegacyDebugOverlay: () => null }));
vi.mock('../i18n', () => ({
  useLegacyI18n: () => ({ isRtl: false, t: (key: string) => key }),
}));

beforeEach(() => {
  makeDevice.mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
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

  it('starts WebOS notifications before cache initialization and signals readiness after mount', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('webOS');
    let resolveCache!: () => void;
    initCache.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCache = resolve;
      })
    );
    render(() => <PlayerFrame />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'legacyPlayer.initializing'
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
