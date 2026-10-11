import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { sha256 } from 'js-sha256';
import {
  FIRMWARE_DOWNLOAD_TIMEOUT_MS,
  FIRMWARE_STATUS_POLL_MS,
  WebosMachine,
} from './webos-machine';

vi.stubEnv('VITE_UPDATE_URL', 'https://update.castmill.io/webos/player.ipk');

vi.mock('../native', () => ({
  storage: {
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve({ data: 'mocked_credentials' })),
    removeFile: vi.fn(() => Promise.resolve()),
    upgradeApplication: vi.fn(() => Promise.resolve()),
    downloadFirmware: vi.fn(() => Promise.resolve()),
    upgradeFirmware: vi.fn(() => Promise.resolve()),
    getStorageInfo: vi.fn(),
    getFirmwareUpgradeStatus: vi.fn(),
  },
  deviceInfo: {
    getNetworkMacInfo: vi.fn(() =>
      Promise.resolve({
        wiredInfo: { macAddress: '00:11:22:33:44:55' },
        wifiInfo: { macAddress: undefined },
      })
    ),
    getNetworkInfo: vi.fn(),
    getPlatformInfo: vi.fn(() =>
      Promise.resolve({
        manufacturer: 'LG',
        modelName: '55XS2E-BH',
        firmwareVersion: '4.2.1',
      })
    ),
  },
  configuration: {
    restartApplication: vi.fn(() => Promise.resolve()),
    setServerProperty: vi.fn(() => Promise.resolve()),
    getTimeZone: vi.fn(),
  },
  power: {
    executePowerCommand: vi.fn(() => Promise.resolve()),
  },
}));

const monitor = vi.hoisted(() => ({
  getFanStatus: vi.fn(),
}));

vi.mock('./system-monitor', () => ({
  systemMonitor: {
    isMonitoring: () => true,
    getTemperature: () => null,
    getFanStatus: monitor.getFanStatus,
  },
}));

vi.mock('../../package.json', () => ({
  version: '1.0.0',
}));

import { deviceInfo, storage, configuration, power } from '../native';

describe('WebosMachine', () => {
  let machine: WebosMachine;

  beforeEach(() => {
    machine = new WebosMachine();
    vi.mocked(deviceInfo.getNetworkInfo).mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses the same SHA-256 MAC identifier as the legacy WebOS player', async () => {
    const guid = await machine.getMachineGUID();
    expect(guid).toBe(sha256('00:11:22:33:44:55'));
    expect(guid).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceInfo.getNetworkMacInfo).toHaveBeenCalledOnce();
  });

  it('falls back to the Wi-Fi MAC address for the identifier', async () => {
    vi.mocked(deviceInfo.getNetworkMacInfo).mockResolvedValueOnce({
      wiredInfo: { macAddress: '' },
      wifiInfo: { macAddress: 'aa:bb:cc:dd:ee:ff' },
    });
    expect(await machine.getMachineGUID()).toBe(sha256('aa:bb:cc:dd:ee:ff'));
  });

  it('refuses to derive an identifier without a MAC address', async () => {
    vi.mocked(deviceInfo.getNetworkMacInfo).mockResolvedValueOnce({
      wiredInfo: { macAddress: '' },
      wifiInfo: { macAddress: '' },
    });
    await expect(machine.getMachineGUID()).rejects.toThrow(
      'No mac address found'
    );
  });

  it('should store credentials', async () => {
    const credentials = 'test_credentials';
    await machine.storeCredentials(credentials);
    expect(storage.writeFile).toHaveBeenCalledWith({
      path: 'file://internal/credentials.txt',
      data: credentials,
    });
  });

  it('should retrieve stored credentials', async () => {
    vi.mocked(storage.readFile).mockResolvedValueOnce({
      data: 'mocked_credentials',
    });
    const credentials = await machine.getCredentials();
    expect(credentials).toBe('mocked_credentials');
    expect(storage.readFile).toHaveBeenCalledWith({
      path: 'file://internal/credentials.txt',
    });
  });

  it('should remove stored credentials', async () => {
    await machine.removeCredentials();
    expect(storage.removeFile).toHaveBeenCalledWith({
      file: 'file://internal/credentials.txt',
    });
  });

  it('should return device info', async () => {
    vi.mocked(deviceInfo.getPlatformInfo).mockResolvedValueOnce({
      manufacturer: 'LG',
      modelName: '55XS2E-BH',
      firmwareVersion: '4.2.1',
    });
    const deviceInfoResult = await machine.getDeviceInfo();
    expect(deviceInfoResult).toEqual({
      appType: 'LG WebOS',
      appVersion: '1.0.0',
      os: 'LG WebOS',
      hardware: '55XS2E-BH',
      environmentVersion: '4.2.1',
      chromiumVersion: undefined,
      userAgent: navigator.userAgent,
    });
    expect(deviceInfo.getPlatformInfo).toHaveBeenCalledOnce();
  });

  it('converts SCAP storage telemetry from KB to bytes', async () => {
    vi.mocked(storage.getStorageInfo).mockResolvedValueOnce({
      total: 10000,
      used: 2000,
      free: 8000,
    });
    expect((await machine.getTelemetry()).storage).toEqual({
      totalBytes: 10000 * 1024,
      usedBytes: 2000 * 1024,
    });
  });

  it.each([
    [
      { state: 'connected', ipAddress: '10.0.0.2' },
      { state: 'disconnected' },
      { type: 'ethernet', ipAddress: '10.0.0.2' },
    ],
    [
      { state: 'disconnected' },
      { state: 'connected', ipAddress: '10.0.0.3' },
      { type: 'wifi', ipAddress: '10.0.0.3' },
    ],
    [{ state: 'disconnected' }, { state: 'disconnected' }, undefined],
  ])('reports the connected network %#', async (wired, wifi, expected) => {
    vi.mocked(deviceInfo.getNetworkInfo).mockResolvedValueOnce({
      wired,
      wifi,
    } as never);
    expect((await machine.getTelemetry()).network).toEqual(expected);
  });

  it('keeps telemetry when network info fails', async () => {
    vi.mocked(deviceInfo.getNetworkInfo).mockRejectedValueOnce(
      new Error('no network api')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await machine.getTelemetry()).network).toBeUndefined();
  });

  it('reports only fans with a measured RPM', async () => {
    monitor.getFanStatus.mockReturnValueOnce({
      fanStatus: [{ name: 'Main', rpm: 1200 }, { status: 'ok' }, { rpm: 900 }],
    });
    expect((await machine.getTelemetry()).fanSpeeds).toEqual([
      { label: 'Main', rpm: 1200 },
      { label: 'Fan 3', rpm: 900 },
    ]);
  });

  it('omits fan speeds when only fan status is available', async () => {
    monitor.getFanStatus.mockReturnValueOnce({ fanStatus: [{ status: 'ok' }] });
    expect((await machine.getTelemetry()).fanSpeeds).toBeUndefined();
  });

  it('does not advertise a quit capability', async () => {
    expect('quit' in machine).toBe(false);
  });

  it('should restart the application', async () => {
    await machine.restart();
    expect(configuration.restartApplication).toHaveBeenCalledOnce();
  });

  it('should reboot the device', async () => {
    await machine.reboot();
    expect(power.executePowerCommand).toHaveBeenCalledWith({
      powerCommand: 'reboot',
    });
  });

  it('should shutdown the device', async () => {
    await machine.shutdown();
    expect(power.executePowerCommand).toHaveBeenCalledWith({
      powerCommand: 'powerOff',
    });
  });

  it('should update the application and reboot', async () => {
    const rebootSpy = vi.spyOn(machine, 'reboot');
    vi.stubEnv('VITE_KEEP_SERVER_SETTINGS', 'false');
    await machine.update();
    expect(configuration.setServerProperty).toHaveBeenCalledWith({
      serverIp: '0.0.0.0',
      serverPort: 0,
      secureConnection: true,
      appLaunchMode: 'local',
      appType: 'ipk',
      fqdnMode: true,
      fqdnAddr: 'https://update.castmill.io/webos/player.ipk',
    });
    expect(storage.upgradeApplication).toHaveBeenCalledOnce();
    expect(rebootSpy).toHaveBeenCalledOnce();
  });

  it('should not overwrite server settings if VITE_KEEP_SERVER_SETTINGS is true', async () => {
    const rebootSpy = vi.spyOn(machine, 'reboot');
    vi.stubEnv('VITE_KEEP_SERVER_SETTINGS', 'true');
    await machine.update();
    expect(configuration.setServerProperty).not.toHaveBeenCalled();
    expect(storage.upgradeApplication).toHaveBeenCalledOnce();
    expect(rebootSpy).toHaveBeenCalledOnce();
  });

  it('should overwrite server settings if VITE_KEEP_SERVER_SETTINGS is unset', async () => {
    const rebootSpy = vi.spyOn(machine, 'reboot');
    vi.stubEnv('VITE_KEEP_SERVER_SETTINGS', undefined);
    await machine.update();
    expect(configuration.setServerProperty).toHaveBeenCalledOnce();
    expect(storage.upgradeApplication).toHaveBeenCalledOnce();
    expect(rebootSpy).toHaveBeenCalledOnce();
  });

  describe('firmware update', () => {
    const url = 'https://update.castmill.io/webos/firmware/LG-55XS2E-BH.epk';
    beforeEach(() => {
      vi.spyOn(machine, 'getFirmwareDownloadUrl').mockResolvedValue(url);
      vi.mocked(storage.getStorageInfo).mockResolvedValue({
        total: 8 * 1024 * 1024,
        used: 0,
        free: 2 * 1024 * 1024,
      });
      vi.mocked(storage.downloadFirmware).mockResolvedValue(undefined);
      vi.mocked(storage.upgradeFirmware).mockResolvedValue(undefined);
    });

    it('waits for the download before upgrading', async () => {
      vi.useFakeTimers();
      vi.mocked(storage.getFirmwareUpgradeStatus)
        .mockResolvedValueOnce({ status: 'downloading' } as never)
        .mockResolvedValueOnce({ status: 'ready' } as never);

      const update = machine.updateFirmware();
      await vi.advanceTimersByTimeAsync(FIRMWARE_STATUS_POLL_MS);
      await update;

      expect(storage.downloadFirmware).toHaveBeenCalledWith({ uri: url });
      expect(storage.getFirmwareUpgradeStatus).toHaveBeenCalledTimes(2);
      expect(storage.upgradeFirmware).toHaveBeenCalledOnce();
    });

    it('requires 1 GB of free storage', async () => {
      vi.mocked(storage.getStorageInfo).mockResolvedValue({
        total: 8 * 1024 * 1024,
        used: 0,
        free: 1024 * 1024 - 1,
      });
      await expect(machine.updateFirmware()).rejects.toThrow(
        'Not enough free space'
      );
      expect(storage.downloadFirmware).not.toHaveBeenCalled();
    });

    it.each([
      ['fail', 'Firmware download failed'],
      ['idle', 'Unexpected firmware status: idle'],
    ])('stops on %s status', async (status, message) => {
      vi.mocked(storage.getFirmwareUpgradeStatus).mockResolvedValue({
        status,
      } as never);
      await expect(machine.updateFirmware()).rejects.toThrow(message);
      expect(storage.upgradeFirmware).not.toHaveBeenCalled();
    });

    it('times out a download that never completes', async () => {
      vi.useFakeTimers();
      vi.mocked(storage.getFirmwareUpgradeStatus).mockResolvedValue({
        status: 'downloading',
      } as never);
      const update = machine.updateFirmware();
      const assertion = expect(update).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(
        FIRMWARE_DOWNLOAD_TIMEOUT_MS + FIRMWARE_STATUS_POLL_MS
      );
      await assertion;
      expect(storage.upgradeFirmware).not.toHaveBeenCalled();
    });
  });

  it('should get the firmware download URL', async () => {
    vi.mocked(deviceInfo.getPlatformInfo).mockResolvedValueOnce({
      manufacturer: 'LG',
      modelName: '55XS2E-BH',
      firmwareVersion: '4.2.1',
    });
    const url = await machine['getFirmwareDownloadUrl']();
    expect(url).toBe(
      'https://update.castmill.io/webos/firmware/LG-55XS2E-BH.epk'
    );
  });

  it('should return undefined if geolocation fails', async () => {
    const geolocationError: GeolocationPositionError = {
      code: 1, // Example: 1 corresponds to PERMISSION_DENIED
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: 'User denied Geolocation',
    };

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success, error) => error(geolocationError)),
      },
    });

    const location = await machine.getLocation();
    expect(location).toBeUndefined();
  });

  it('passes a timeout to geolocation and resolves coordinates', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: 1, longitude: 2 } })
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    expect(await machine.getLocation()).toEqual({ latitude: 1, longitude: 2 });
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      timeout: 10_000,
    });
  });

  it('does not wait forever for geolocation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: vi.fn() },
    });
    const location = machine.getLocation();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await location).toBeUndefined();
  });

  it('should return timezone', async () => {
    const timezone = await machine.getTimezone();
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  describe('without an Intl time zone', () => {
    beforeEach(() => {
      vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: undefined }),
      } as never);
    });
    afterEach(() => vi.restoreAllMocks());

    it('uses the SCAP time zone', async () => {
      vi.mocked(configuration.getTimeZone).mockResolvedValueOnce({
        timeZone: { continent: 'America', country: 'US', city: 'New York' },
      });
      expect(await machine.getTimezone()).toBe('America/New_York');
    });

    it('falls back to UTC', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(configuration.getTimeZone).mockRejectedValueOnce(
        new Error('unsupported')
      );
      expect(await machine.getTimezone()).toBe('UTC');
    });
  });

  it.each([0, 90, 180, 270] as const)(
    'selects shared CSS rotation for %i without a verified native API',
    async (angle) => {
      expect(await new WebosMachine().setOrientation(angle)).toEqual({
        mode: 'css',
      });
    }
  );
});
