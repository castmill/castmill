import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { sha256 } from 'js-sha256';
import {
  CPU_SAMPLE_INTERVAL_MS,
  FIRMWARE_DOWNLOAD_TIMEOUT_MS,
  FIRMWARE_STATUS_POLL_MS,
  TELEMETRY_BUDGET_MS,
  WebosMachine,
} from './webos-machine';

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
    getSystemUsageInfo: vi.fn(),
    getWifiList: vi.fn(),
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
    getTimeZone: vi.fn(),
    clearCache: vi.fn(() => Promise.resolve()),
  },
  power: {
    executePowerCommand: vi.fn(() => Promise.resolve()),
  },
}));

const version = vi.hoisted(() => ({ getWebosVersion: vi.fn() }));
vi.mock('../native/webos-version', () => version);

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

  it('includes the webOS version in the reported OS', async () => {
    vi.mocked(deviceInfo.getPlatformInfo).mockResolvedValueOnce({
      manufacturer: 'LG',
      modelName: '55XS2E-BH',
      firmwareVersion: '4.2.1',
    });
    version.getWebosVersion.mockResolvedValueOnce('4.1');
    expect((await machine.getDeviceInfo()).os).toBe('LG WebOS 4.1');
  });

  it('falls back to a generic OS name when the version lookup fails', async () => {
    vi.mocked(deviceInfo.getPlatformInfo).mockResolvedValueOnce({
      manufacturer: 'LG',
      modelName: '55XS2E-BH',
      firmwareVersion: '4.2.1',
    });
    version.getWebosVersion.mockRejectedValueOnce(new Error('no custom.js'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await machine.getDeviceInfo()).os).toBe('LG WebOS');
  });

  it('clears the platform cache through SCAP', async () => {
    vi.mocked(configuration.clearCache).mockResolvedValueOnce();
    await machine.clearCache();
    expect(configuration.clearCache).toHaveBeenCalledOnce();
  });

  describe('system usage telemetry', () => {
    const cpu = (busy: number, idle: number) => ({
      model: 'arm',
      speed: 1000,
      times: { user: busy, nice: 0, sys: 0, idle, irq: 0 },
    });
    const usage = (busy: number, idle: number) => ({
      memory: { total: 2_000, free: 500 },
      cpus: [cpu(busy, idle), cpu(busy, idle)],
    });

    it('reports memory in bytes and CPU usage from two samples', async () => {
      vi.useFakeTimers();
      vi.mocked(deviceInfo.getSystemUsageInfo!)
        .mockResolvedValueOnce(usage(100, 900) as never)
        .mockResolvedValueOnce(usage(130, 970) as never)
        .mockResolvedValueOnce(usage(230, 1070) as never);
      const first = machine.getTelemetry();
      await vi.advanceTimersByTimeAsync(CPU_SAMPLE_INTERVAL_MS);
      const telemetry = await first;
      expect(telemetry.memory).toEqual({ totalBytes: 2_000, usedBytes: 1_500 });
      expect(telemetry.cpuUsagePercent).toBe(30);
      expect(deviceInfo.getSystemUsageInfo).toHaveBeenCalledWith({
        cpus: true,
        memory: true,
      });

      // Later calls reuse the previous sample instead of waiting.
      expect((await machine.getTelemetry()).cpuUsagePercent).toBe(50);
      expect(deviceInfo.getSystemUsageInfo).toHaveBeenCalledTimes(3);
    });

    it('omits CPU usage when no CPU times are reported', async () => {
      vi.mocked(deviceInfo.getSystemUsageInfo!).mockResolvedValueOnce({
        memory: { total: 0, free: 0 },
        cpus: [],
      } as never);
      const telemetry = await machine.getTelemetry();
      expect(telemetry.cpuUsagePercent).toBeUndefined();
      expect(telemetry.memory).toBeUndefined();
    });

    it('omits CPU usage when the second sample is unavailable', async () => {
      vi.useFakeTimers();
      vi.mocked(deviceInfo.getSystemUsageInfo!)
        .mockResolvedValueOnce(usage(100, 900) as never)
        .mockResolvedValueOnce({ memory: undefined } as never);
      const pending = machine.getTelemetry();
      await vi.advanceTimersByTimeAsync(CPU_SAMPLE_INTERVAL_MS);
      expect((await pending).cpuUsagePercent).toBeUndefined();
    });

    it('omits CPU usage when the counters did not advance', async () => {
      vi.useFakeTimers();
      vi.mocked(deviceInfo.getSystemUsageInfo!)
        .mockResolvedValueOnce(usage(100, 900) as never)
        .mockResolvedValueOnce(usage(100, 900) as never);
      const pending = machine.getTelemetry();
      await vi.advanceTimersByTimeAsync(CPU_SAMPLE_INTERVAL_MS);
      expect((await pending).cpuUsagePercent).toBeUndefined();
    });

    it('returns other fields when a system usage call never answers', async () => {
      vi.useFakeTimers();
      vi.mocked(deviceInfo.getSystemUsageInfo!).mockReturnValueOnce(
        new Promise(() => {}) as never
      );
      vi.mocked(deviceInfo.getNetworkInfo).mockResolvedValueOnce({
        wired: { state: 'connected', ipAddress: '10.0.0.2' },
      } as never);
      const pending = machine.getTelemetry();
      await vi.advanceTimersByTimeAsync(TELEMETRY_BUDGET_MS);
      const telemetry = await pending;
      expect(TELEMETRY_BUDGET_MS).toBeLessThan(5_000);
      expect(telemetry.memory).toBeUndefined();
      expect(telemetry.network).toEqual({
        type: 'ethernet',
        ipAddress: '10.0.0.2',
      });
    });

    it('keeps telemetry when system usage fails', async () => {
      vi.mocked(deviceInfo.getSystemUsageInfo!).mockRejectedValueOnce(
        new Error('unsupported')
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const telemetry = await machine.getTelemetry();
      expect(telemetry.memory).toBeUndefined();
      expect(telemetry.cpuUsagePercent).toBeUndefined();
    });
  });

  describe('Wi-Fi telemetry', () => {
    const connectWifi = (wifi: Record<string, unknown> = {}) =>
      vi.mocked(deviceInfo.getNetworkInfo).mockResolvedValueOnce({
        wired: { state: 'disconnected' },
        wifi: { state: 'connected', ipAddress: '10.0.0.3', ...wifi },
      } as never);

    it('reports the SSID and signal of the connected network', async () => {
      connectWifi();
      vi.mocked(deviceInfo.getWifiList!).mockResolvedValueOnce({
        networkInfo: [
          { ssid: 'Other', signalLevel: 90 },
          { ssid: 'Office', signalLevel: 72, connected: true },
        ],
      });
      expect((await machine.getTelemetry()).network).toEqual({
        type: 'wifi',
        ipAddress: '10.0.0.3',
        ssid: 'Office',
        wifiSignalStrengthPercent: 72,
      });
    });

    it('matches the network by SSID when firmware reports one', async () => {
      connectWifi({ ssid: 'Office' });
      vi.mocked(deviceInfo.getWifiList!).mockResolvedValueOnce({
        networkInfo: [
          { ssid: 'Other', signalLevel: 90 },
          { ssid: 'Office', signalLevel: 140 },
        ],
      });
      expect((await machine.getTelemetry()).network).toMatchObject({
        ssid: 'Office',
        wifiSignalStrengthPercent: 100,
      });
    });

    it('omits the signal when the network cannot be identified', async () => {
      connectWifi();
      vi.mocked(deviceInfo.getWifiList!).mockResolvedValueOnce({
        networkInfo: [{ ssid: 'Other', signalLevel: 90 }],
      });
      expect((await machine.getTelemetry()).network).toEqual({
        type: 'wifi',
        ipAddress: '10.0.0.3',
      });
    });

    it('omits missing SSIDs and invalid signal levels', async () => {
      connectWifi();
      vi.mocked(deviceInfo.getWifiList!).mockResolvedValueOnce({
        networkInfo: [{ connected: true, signalLevel: Number.NaN }],
      });
      expect((await machine.getTelemetry()).network).toEqual({
        type: 'wifi',
        ipAddress: '10.0.0.3',
      });
    });

    it('returns collected fields when the Wi-Fi scan exceeds the budget', async () => {
      vi.useFakeTimers();
      connectWifi();
      vi.mocked(deviceInfo.getWifiList!).mockReturnValueOnce(
        new Promise(() => {})
      );
      vi.mocked(storage.getStorageInfo).mockResolvedValueOnce({
        total: 1,
        used: 1,
      } as never);
      const pending = machine.getTelemetry();
      await vi.advanceTimersByTimeAsync(TELEMETRY_BUDGET_MS);
      const telemetry = await pending;
      expect(telemetry.network).toEqual({
        type: 'wifi',
        ipAddress: '10.0.0.3',
      });
      expect(telemetry.storage).toEqual({ totalBytes: 1024, usedBytes: 1024 });
    });

    it('keeps the network type when the Wi-Fi scan fails', async () => {
      connectWifi();
      vi.mocked(deviceInfo.getWifiList!).mockRejectedValueOnce(
        new Error('scan failed')
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect((await machine.getTelemetry()).network).toEqual({
        type: 'wifi',
        ipAddress: '10.0.0.3',
      });
    });
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

  it('updates from the configured server without changing it', async () => {
    const rebootSpy = vi.spyOn(machine, 'reboot');
    await machine.update();
    expect(storage.upgradeApplication).toHaveBeenCalledWith({
      type: 'ipk',
      to: 'local',
      recovery: true,
    });
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
