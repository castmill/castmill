import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { AndroidMachine } from './android-machine';
import { Device } from '@capacitor/device';
import { Toast } from '@capacitor/toast';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Castmill } from '../../plugins/castmill';
import { delay } from '../utils';

vi.mock('@capacitor/device', () => ({
  Device: {
    getId: vi.fn(),
    getInfo: vi.fn(),
  },
}));

vi.mock('@capacitor/toast', () => ({
  Toast: {
    show: vi.fn(),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn(),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../plugins/castmill', () => ({
  Castmill: {
    restart: vi.fn(),
    quit: vi.fn(),
    reboot: vi.fn(),
  },
}));

vi.mock('../utils', () => ({
  delay: vi.fn(),
}));

describe('AndroidMachine', () => {
  let machine: AndroidMachine;

  beforeEach(() => {
    machine = new AndroidMachine();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return machine GUID', async () => {
    const mockDeviceId = { identifier: '1234-5678-9012' };
    vi.mocked(Device.getId).mockResolvedValue(mockDeviceId);

    const guid = await machine.getMachineGUID();
    expect(guid).toBe('1234-5678-9012');
    expect(Device.getId).toHaveBeenCalled();
  });

  it('should store credentials', async () => {
    const credentials = 'test-credentials';
    await machine.storeCredentials(credentials);

    expect(Preferences.set).toHaveBeenCalledWith({
      key: 'credentials',
      value: credentials,
    });
  });

  it('should retrieve stored credentials', async () => {
    const mockCredentials = { value: 'test-credentials' };
    vi.mocked(Preferences.get).mockResolvedValue(mockCredentials);

    const credentials = await machine.getCredentials();
    expect(credentials).toBe('test-credentials');
    expect(Preferences.get).toHaveBeenCalledWith({ key: 'credentials' });
  });

  it('should return null when credentials are not found', async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });

    const credentials = await machine.getCredentials();
    expect(credentials).toBeNull();
  });

  it('should remove credentials', async () => {
    await machine.removeCredentials();
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'credentials' });
  });

  it('should return location when available', async () => {
    const mockLocation = {
      coords: { latitude: 51.509865, longitude: -0.118092 },
      timestamp: Date.now(),
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    };

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success, error) => success(mockLocation)),
      },
    });

    const location = await machine.getLocation();
    expect(location).toEqual({
      latitude: 51.509865,
      longitude: -0.118092,
    });
  });

  it('should return undefined when location is unavailable', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success, error) => error(new Error('Location error'))),
      },
    });

    const location = await machine.getLocation();
    expect(location).toBeUndefined();
  });

  it('should return the current timezone', async () => {
    const timezone = await machine.getTimezone();
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('should return device information', async () => {
    vi.mocked(Device.getInfo).mockResolvedValue({
      platform: 'android',
      operatingSystem: 'android',
      model: 'Pixel',
      osVersion: '12',
      webViewVersion: '88.0',
      manufacturer: 'Google',
      isVirtual: false,
    });
    vi.mocked(App.getInfo).mockResolvedValue({
      version: '1.0.0',
      name: 'Test App',
      id: 'com.test.app',
      build: '1',
    });

    const deviceInfo = await machine.getDeviceInfo();
    expect(deviceInfo).toEqual({
      appType: 'android',
      appVersion: '1.0.0',
      os: 'android',
      hardware: 'Pixel',
      environmentVersion: '12',
      chromiumVersion: '88.0',
      userAgent: navigator.userAgent,
    });
  });

  it('should handle missing App plugin by using default app version', async () => {
    vi.mocked(Device.getInfo).mockResolvedValue({
      platform: 'android',
      operatingSystem: 'android',
      model: 'Pixel',
      osVersion: '12',
      webViewVersion: '88.0',
      manufacturer: 'Google',
      isVirtual: false,
    });
    vi.mocked(App.getInfo).mockRejectedValueOnce(
      new Error('App plugin not available')
    );

    const deviceInfo = await machine.getDeviceInfo();
    expect(deviceInfo.appVersion).toBe('N/A');
  });

  it('should restart the application', async () => {
    await machine.restart();

    expect(Toast.show).toHaveBeenCalledWith({
      text: 'About to restart',
    });
    expect(delay).toHaveBeenCalledWith(3000);
    expect(Castmill.restart).toHaveBeenCalled();
  });

  it('should quit the application', async () => {
    await machine.quit();

    expect(Toast.show).toHaveBeenCalledWith({
      text: 'About to quit',
    });
    expect(delay).toHaveBeenCalledWith(3000);
    expect(Castmill.quit).toHaveBeenCalled();
  });

  it('should reboot the device', async () => {
    await machine.reboot();

    expect(Toast.show).toHaveBeenCalledWith({
      text: 'About to reboot',
    });
    expect(delay).toHaveBeenCalledWith(3000);
    expect(Castmill.reboot).toHaveBeenCalled();
  });

  it('should log shutdown without implementation', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    await machine.shutdown();

    expect(consoleSpy).toHaveBeenCalledWith('Shutdown');
  });

  it('should log update without implementation', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    await machine.update();

    expect(consoleSpy).toHaveBeenCalledWith('Update');
  });
});
