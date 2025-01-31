import { vi, describe, it, beforeEach, expect, MockedFunction } from 'vitest';
import { WebosMachine } from './webos-machine';

vi.mock('../native', () => ({
  storage: {
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve({ data: 'mocked_credentials' })),
    removeFile: vi.fn(() => Promise.resolve()),
    upgradeApplication: vi.fn(() => Promise.resolve()),
    downloadFirmware: vi.fn(() => Promise.resolve()),
    upgradeFirmware: vi.fn(() => Promise.resolve()),
  },
  deviceInfo: {
    getNetworkMacInfo: vi.fn(() =>
      Promise.resolve({
        wiredInfo: { macAddress: '00:11:22:33:44:55' },
        wifiInfo: { macAddress: undefined },
      })
    ),
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
  },
  power: {
    executePowerCommand: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('./utils', () => ({
  simpleHash: vi.fn((text: string) => 'hashed_' + text),
}));

vi.mock('../../package.json', () => ({
  version: '1.0.0',
}));

import { deviceInfo, storage, configuration, power } from '../native';
import { simpleHash } from './utils';

describe('WebosMachine', () => {
  let machine: WebosMachine;

  beforeEach(() => {
    machine = new WebosMachine();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return machine GUID', async () => {
    const guid = await machine.getMachineGUID();
    expect(guid).toBe('hashed_00:11:22:33:44:55');
    expect(deviceInfo.getNetworkMacInfo).toHaveBeenCalledOnce();
    expect(simpleHash).toHaveBeenCalledWith('00:11:22:33:44:55');
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
      file: 'credentials.txt',
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
      fqdnAddr: 'https://update.castmill.io/webos/player-new.ipk',
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

  it('should update the firmware', async () => {
    const url = 'https://update.castmill.io/webos/firmware/LG-55XS2E-BH.epk';
    const urlSpy = vi
      .spyOn<any, any>(machine, 'getFirmwareDownloadUrl')
      .mockResolvedValueOnce(url);

    await machine.updateFirmware();
    expect(urlSpy).toHaveBeenCalledOnce();
    expect(storage.downloadFirmware).toHaveBeenCalledWith({ uri: url });
    expect(storage.upgradeFirmware).toHaveBeenCalledOnce();
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

  it('should return timezone', async () => {
    const timezone = await machine.getTimezone();
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
