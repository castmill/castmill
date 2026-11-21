import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { AndroidLegacyMachine, UNSET_VALUE } from './android-legacy-machine';
vi.mock('../android-legacy-api', () => ({
  initAndroidLegacyApi: vi.fn(),
  getPlayerData: vi.fn().mockResolvedValue({
    uuid: 'mocked_uuid',
    player_version: 'mocked_player_version',
    model: 'mocked_model',
    platform: 'Android',
    android_version: '5.1.1',
  }),
  getItem: vi.fn().mockResolvedValue('mocked_value'),
  setItem: vi.fn().mockResolvedValue(undefined),
  reboot: vi.fn().mockResolvedValue(undefined),
  restart: vi.fn().mockResolvedValue(undefined),
  sendHeartbeat: vi.fn(),
  sendPlayerReady: vi.fn(),
}));

import {
  initAndroidLegacyApi,
  getPlayerData,
  setItem,
  reboot,
  restart,
  sendHeartbeat,
  sendPlayerReady,
} from '../android-legacy-api';

describe('AndroidLegacyMachine', () => {
  let machine: AndroidLegacyMachine;

  beforeEach(() => {
    machine = new AndroidLegacyMachine();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should initialize legacy with heartbeat and player ready', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    machine.initLegacy();

    expect(initAndroidLegacyApi).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();

    const intervalCallback = setIntervalSpy.mock.calls[0][0] as () => void;
    intervalCallback();
    expect(sendHeartbeat).toHaveBeenCalled();

    const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as () => void;
    timeoutCallback();
    expect(sendPlayerReady).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('should return machine GUID', async () => {
    const guid = await machine.getMachineGUID();
    expect(guid).toBe('mocked_uuid');
    expect(getPlayerData).toHaveBeenCalled();
  });

  it('should store, get, and remove credentials', async () => {
    await machine.storeCredentials('mocked_credentials');
    expect(setItem).toHaveBeenCalledWith('CREDENTIALS', 'mocked_credentials');

    const credentials = await machine.getCredentials();
    expect(credentials).toBe('mocked_value');

    await machine.removeCredentials();
    expect(setItem).toHaveBeenCalledWith('CREDENTIALS', UNSET_VALUE);
  });

  it('should return location as undefined', async () => {
    const location = await machine.getLocation();
    expect(location).toBeUndefined();
  });

  it('returns coordinates when geolocation is available', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: 59.33, longitude: 18.07 } })
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await expect(machine.getLocation()).resolves.toEqual({
      latitude: 59.33,
      longitude: 18.07,
    });
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
  });

  it('stops waiting when geolocation never responds', async () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const location = machine.getLocation();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(location).resolves.toBeUndefined();
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ timeout: 5000 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('continues without location when permission is denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => error({ code: 1 })),
      },
    });

    await expect(machine.getLocation()).resolves.toBeUndefined();
  });

  it('should return the current timezone', async () => {
    const timezone = await machine.getTimezone();
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('should return device info', async () => {
    const info = await machine.getDeviceInfo();
    expect(info).toEqual({
      appType: 'Legacy Android adapter',
      appVersion: 'mocked_player_version',
      os: 'Android 5.1.1',
      hardware: 'mocked_model',
      chromiumVersion: undefined, // No user agent mocking in test environment
      userAgent: navigator.userAgent,
    });
  });

  it('requests a native restart and schedules a browser reload fallback', async () => {
    vi.useFakeTimers();

    await machine.restart();

    expect(restart).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // window.location.reload() can't be mocked in the test environment
  it.skip('should refresh the browser');

  it('should reboot the device', async () => {
    await machine.reboot();
    expect(reboot).toHaveBeenCalled();
  });
});
