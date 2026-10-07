import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { PlayerFrame } from './player-frame';
import { mountDevice } from '@castmill/device';
import { createWebosVideoPlayback, WebosWebSocket } from '../shared';

const mocks = vi.hoisted(() => ({
  device: vi.fn(),
  init: vi.fn(),
  getBaseUrl: vi.fn(),
  reportStartupError: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  cacheInit: vi.fn(),
  setServerOrigin: vi.fn(),
  storage: vi.fn(),
  enableDebug: vi.fn(),
}));
vi.mock('@castmill/device', () => ({
  Device: mocks.device,
  mountDevice: vi.fn(),
}));
vi.mock('@castmill/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/cache')>()),
  MemoryCache: class {
    constructor(readonly storage: unknown) {}
    init = mocks.cacheInit;
  },
}));
vi.mock('@castmill/player', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/player')>()),
  enableDebugOverlayFromEnv: mocks.enableDebug,
}));
vi.mock('../classes', () => ({
  WebosMachine: class {},
  FileStorage: class {
    constructor() {
      mocks.storage();
    }
    setServerOrigin = mocks.setServerOrigin;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.init.mockResolvedValue(undefined);
  mocks.getBaseUrl.mockResolvedValue('https://api.test');
  mocks.cacheInit.mockResolvedValue(undefined);
  mocks.storage.mockImplementation(() => {});
  mocks.device.mockImplementation(() => ({
    init: mocks.init,
    getBaseUrl: mocks.getBaseUrl,
    reportStartupError: mocks.reportStartupError,
    on: mocks.on,
    off: mocks.off,
  }));
  vi.mocked(mountDevice).mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Native WebOS startup', () => {
  it('injects the shared runtime and memory cache before mounting', async () => {
    render(() => <PlayerFrame />);
    const startup = screen.getByRole('status');
    await waitFor(() => expect(mountDevice).toHaveBeenCalledOnce());
    expect(startup.style.display).toBe('none');
    const [machine, storage, options] = mocks.device.mock.calls[0];
    expect(machine).toBeDefined();
    expect(options.transport).toBe(WebosWebSocket);
    expect(options.createVideoPlaybackController).toBe(
      createWebosVideoPlayback
    );
    expect(options.cacheBackend.storage).toBe(storage);
    expect(mocks.setServerOrigin).toHaveBeenCalledWith('https://api.test');
    expect(mocks.cacheInit).toHaveBeenCalledOnce();
  });

  it.each(['configuration', 'cache', 'mount', 'baseUrl'])(
    'reports and displays failures during %s',
    async (step) => {
      const error = new Error(`${step} unavailable`);
      if (step === 'configuration') mocks.init.mockRejectedValueOnce(error);
      if (step === 'baseUrl') mocks.getBaseUrl.mockRejectedValueOnce(error);
      if (step === 'cache') mocks.cacheInit.mockRejectedValueOnce(error);
      if (step === 'mount')
        vi.mocked(mountDevice).mockImplementationOnce(() => {
          throw error;
        });
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(() => <PlayerFrame />);
      expect(await screen.findByRole('alert')).toHaveTextContent(error.message);
      expect(mocks.reportStartupError).toHaveBeenCalledWith(error);
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('initialization failed during'),
        error
      );
      if (step !== 'mount') expect(mountDevice).not.toHaveBeenCalled();
    }
  );

  it('shows construction errors even before a device exists', async () => {
    mocks.storage.mockImplementationOnce(() => {
      throw 'Storage unavailable';
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => <PlayerFrame />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable'
    );
    expect(mocks.reportStartupError).not.toHaveBeenCalled();
    expect(mountDevice).not.toHaveBeenCalled();
  });

  it('passes the configured playback diagnostics flag to the player', async () => {
    vi.stubEnv('VITE_DEBUG_OVERLAY', 'true');
    render(() => <PlayerFrame />);
    await waitFor(() => expect(mountDevice).toHaveBeenCalledOnce());
    expect(mocks.enableDebug).toHaveBeenCalledWith('true');
  });

  it('shows post-mount startup errors without relying on reactive DOM updates', async () => {
    render(() => <PlayerFrame />);
    await waitFor(() => expect(mountDevice).toHaveBeenCalledOnce());
    const [event, listener] = mocks.on.mock.calls[0];
    expect(event).toBe('startup-error');
    listener(new Error('Channel load failed'));
    const overlay = screen.getByRole('alert');
    expect(overlay.textContent).toBe('Channel load failed');
    expect(overlay.style.display).toBe('flex');
    cleanup();
    expect(mocks.off).toHaveBeenCalledWith('startup-error', listener);
  });
});
