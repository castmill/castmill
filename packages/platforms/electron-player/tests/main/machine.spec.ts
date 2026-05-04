import { beforeEach, describe, expect, it, vi } from 'vitest';
import { is } from '@electron-toolkit/utils';

const updateHandlers: Record<string, () => void> = {};

const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn((event: string, handler: () => void) => {
    updateHandlers[event] = handler;
  }),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
};

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false,
  },
}));

const loadUpdate = async () => {
  const mod = await import('../../src/main/api/machine');
  return mod.update;
};

describe('main/api/machine update', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    for (const key of Object.keys(updateHandlers)) {
      delete updateHandlers[key];
    }

    mockAutoUpdater.autoDownload = false;
    mockAutoUpdater.autoInstallOnAppQuit = false;
    is.dev = false;
  });

  it('should be a no-op in development mode', async () => {
    is.dev = true;
    const update = await loadUpdate();

    update();

    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
  });

  it('should configure silent updater and check for updates in production', async () => {
    const update = await loadUpdate();

    update();

    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(mockAutoUpdater.on).toHaveBeenCalledTimes(2);
    expect(mockAutoUpdater.on).toHaveBeenCalledWith(
      'update-downloaded',
      expect.any(Function)
    );
    expect(mockAutoUpdater.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('should trigger quitAndInstall once when update is downloaded', async () => {
    const update = await loadUpdate();

    update();

    updateHandlers['update-downloaded']?.();
    updateHandlers['update-downloaded']?.();

    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('should not register duplicate updater handlers across multiple updates', async () => {
    const update = await loadUpdate();

    update();
    update();

    expect(mockAutoUpdater.on).toHaveBeenCalledTimes(2);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });
});
