import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { ElectronMachine } from '../../src/renderer/src/classes/electron-machine';

// ── Mock globals ────────────────────────────────────────────────────────────
// window.api – Electron preload bridge
const mockApi = {
  setItem: vi.fn(),
  getItem: vi.fn(),
  deleteItem: vi.fn(),
  getMachineGUID: vi.fn(),
  relaunch: vi.fn(),
  quit: vi.fn(),
  reboot: vi.fn(),
  shutdown: vi.fn(),
  update: vi.fn(),
};

// window.electron – Electron process info
const mockElectron = {
  process: {
    versions: {
      electron: '32.0.0',
      chrome: '128.0.0',
      v8: '12.8.0',
      node: '20.16.0',
    },
    env: {
      npm_package_version: '1.2.3',
    },
  },
};

const mockOsInfo = { type: 'Linux', release: '6.1.0' };
const mockHardwareInfo = vi.fn().mockResolvedValue('Test Hardware Model');

// Attach mocks to globalThis (which is `window` in a browser-like env)
Object.defineProperty(globalThis, 'window', {
  value: {
    api: mockApi,
    electron: mockElectron,
    osInfo: mockOsInfo,
    hardwareInfo: mockHardwareInfo,
  },
  writable: true,
});

// navigator.geolocation mock
const mockGetCurrentPosition = vi.fn();
Object.defineProperty(globalThis, 'navigator', {
  value: {
    geolocation: {
      getCurrentPosition: mockGetCurrentPosition,
    },
    userAgent: 'TestAgent/1.0',
  },
  writable: true,
});

// GeolocationPositionError constants (not available in Node)
Object.defineProperty(globalThis, 'GeolocationPositionError', {
  value: {
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  },
  writable: true,
});

// import.meta.env mock
vi.stubEnv('VITE_APP_TYPE', 'Electron-test');

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ElectronMachine', () => {
  let machine: ElectronMachine;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    machine = new ElectronMachine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Settings ────────────────────────────────────────────────────────────

  describe('setSetting', () => {
    it('should call window.api.setItem with prefixed key', async () => {
      await machine.setSetting('BASE_URL', 'https://example.com');

      expect(mockApi.setItem).toHaveBeenCalledWith(
        'castmill-BASE_URL',
        'https://example.com'
      );
    });
  });

  describe('getSetting', () => {
    it('should call window.api.getItem with prefixed key', async () => {
      mockApi.getItem.mockResolvedValue('https://example.com');

      const result = await machine.getSetting('BASE_URL');

      expect(mockApi.getItem).toHaveBeenCalledWith('castmill-BASE_URL');
      expect(result).toBe('https://example.com');
    });

    it('should return null when setting does not exist', async () => {
      mockApi.getItem.mockResolvedValue(null);

      const result = await machine.getSetting('BASE_URL');

      expect(result).toBeNull();
    });
  });

  // ── Machine GUID ────────────────────────────────────────────────────────

  describe('getMachineGUID', () => {
    it('should return the GUID from window.api', async () => {
      mockApi.getMachineGUID.mockResolvedValue('test-guid-1234');

      const guid = await machine.getMachineGUID();

      expect(guid).toBe('test-guid-1234');
      expect(mockApi.getMachineGUID).toHaveBeenCalledOnce();
    });
  });

  // ── Credentials ─────────────────────────────────────────────────────────

  describe('storeCredentials', () => {
    it('should store credentials via window.api.setItem', async () => {
      await machine.storeCredentials('my-secret-token');

      expect(mockApi.setItem).toHaveBeenCalledWith(
        'castmill-credentials',
        'my-secret-token'
      );
    });
  });

  describe('getCredentials', () => {
    it('should retrieve credentials from window.api.getItem', async () => {
      mockApi.getItem.mockResolvedValue('my-secret-token');

      const creds = await machine.getCredentials();

      expect(mockApi.getItem).toHaveBeenCalledWith('castmill-credentials');
      expect(creds).toBe('my-secret-token');
    });
  });

  describe('removeCredentials', () => {
    it('should delete credentials via window.api.deleteItem', async () => {
      await machine.removeCredentials();

      expect(mockApi.deleteItem).toHaveBeenCalledWith('castmill-credentials');
    });
  });

  // ── Geolocation ─────────────────────────────────────────────────────────

  describe('getLocation', () => {
    it('should return latitude and longitude on success', async () => {
      mockGetCurrentPosition.mockImplementation((success) => {
        success({
          coords: { latitude: 59.3293, longitude: 18.0686 },
        });
      });

      const location = await machine.getLocation();

      expect(location).toEqual({
        latitude: 59.3293,
        longitude: 18.0686,
      });
    });

    it('should return undefined when permission is denied', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockGetCurrentPosition.mockImplementation((_success, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'User denied geolocation',
        });
      });

      const location = await machine.getLocation();

      expect(location).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Geolocation permission denied')
      );

      consoleSpy.mockRestore();
    });

    it('should return undefined when position is unavailable', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockGetCurrentPosition.mockImplementation((_success, error) => {
        error({
          code: 2, // POSITION_UNAVAILABLE
          message: 'Position unavailable',
        });
      });

      const location = await machine.getLocation();

      expect(location).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Position unavailable')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('VITE_GOOGLE_API_KEY')
      );

      consoleSpy.mockRestore();
    });

    it('should return undefined when geolocation times out', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockGetCurrentPosition.mockImplementation((_success, error) => {
        error({
          code: 3, // TIMEOUT
          message: 'Timeout expired',
        });
      });

      const location = await machine.getLocation();

      expect(location).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('VITE_GOOGLE_API_KEY')
      );

      consoleSpy.mockRestore();
    });

    it('should return undefined on non-GeolocationPositionError', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockGetCurrentPosition.mockImplementation((_success, error) => {
        error(new Error('Something unexpected'));
      });

      const location = await machine.getLocation();

      expect(location).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get location:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should time out via the safety timer if getCurrentPosition never responds', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Never call success or error — simulates a hung API
      mockGetCurrentPosition.mockImplementation(() => {});

      const locationPromise = machine.getLocation();

      // Advance past the TIMEOUT_MS (3000) + 1000 safety buffer
      await vi.advanceTimersByTimeAsync(4001);

      const location = await locationPromise;

      expect(location).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get location:',
        expect.objectContaining({
          message: 'Geolocation request timed out',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  // ── Timezone ────────────────────────────────────────────────────────────

  describe('getTimezone', () => {
    it('should return a valid IANA timezone string', async () => {
      const tz = await machine.getTimezone();

      // Intl returns a real IANA tz in the test environment
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  // ── Device Info ─────────────────────────────────────────────────────────

  describe('getDeviceInfo', () => {
    it('should return complete device info from window globals', async () => {
      const info = await machine.getDeviceInfo();

      expect(info).toEqual({
        appType: 'Electron-test',
        appVersion: '1.2.3',
        os: 'Linux 6.1.0',
        hardware: 'Test Hardware Model',
        environmentVersion: '32.0.0',
        chromiumVersion: '128.0.0',
        v8Version: '12.8.0',
        nodeVersion: '20.16.0',
        userAgent: 'TestAgent/1.0',
      });
    });

    it('should call window.hardwareInfo()', async () => {
      await machine.getDeviceInfo();

      expect(mockHardwareInfo).toHaveBeenCalledOnce();
    });

    it('should use "unknown" when npm_package_version is missing', async () => {
      const originalVersion = window.electron.process.env.npm_package_version;
      window.electron.process.env.npm_package_version = undefined as any;

      const info = await machine.getDeviceInfo();

      expect(info.appVersion).toBe('unknown');

      // Restore
      window.electron.process.env.npm_package_version = originalVersion;
    });
  });

  // ── Lifecycle Commands ──────────────────────────────────────────────────

  describe('restart', () => {
    it('should call window.api.relaunch()', async () => {
      await machine.restart();
      expect(mockApi.relaunch).toHaveBeenCalledOnce();
    });
  });

  describe('quit', () => {
    it('should call window.api.quit()', async () => {
      await machine.quit();
      expect(mockApi.quit).toHaveBeenCalledOnce();
    });
  });

  describe('reboot', () => {
    it('should call window.api.reboot()', async () => {
      await machine.reboot();
      expect(mockApi.reboot).toHaveBeenCalledOnce();
    });
  });

  describe('shutdown', () => {
    it('should call window.api.shutdown()', async () => {
      await machine.shutdown();
      expect(mockApi.shutdown).toHaveBeenCalledOnce();
    });
  });

  describe('update', () => {
    it('should call window.api.update()', async () => {
      await machine.update();
      expect(mockApi.update).toHaveBeenCalledOnce();
    });
  });
});
