import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { AndroidLegacyMachine, UNSET_VALUE } from './android-legacy-machine';
vi.mock('../android-legacy-api', () => ({
  getPlayerData: vi.fn().mockResolvedValue({
    uuid: 'mocked_uuid',
    player_version: 'mocked_player_version',
    model: 'mocked_model',
  }),
  getItem: vi.fn().mockResolvedValue('mocked_value'),
  setItem: vi.fn().mockResolvedValue(undefined),
  reboot: vi.fn().mockResolvedValue(undefined),
  restart: vi.fn().mockResolvedValue(undefined),
  sendHeartbeat: vi.fn(),
  sendPlayerReady: vi.fn(),
}));

import {
  getPlayerData,
  getItem,
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

  it('should initialize legacy with heartbeat and player ready', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    machine.initLegacy();

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();

    const intervalCallback = setIntervalSpy.mock.calls[0][0] as Function;
    intervalCallback();
    expect(sendHeartbeat).toHaveBeenCalled();

    const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as Function;
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

  it('should return the current timezone', async () => {
    const timezone = await machine.getTimezone();
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('should return device info', async () => {
    const info = await machine.getDeviceInfo();
    expect(info).toEqual({
      appType: 'Legacy adapter',
      appVersion: 'mocked_player_version',
      os: 'Legacy adapter',
      hardware: 'mocked_model',
      chromiumVersion: undefined, // No user agent mocking in test environment
      userAgent: navigator.userAgent,
    });
  });

  it('should restart the device', async () => {
    await machine.restart();
    expect(restart).toHaveBeenCalled();
  });

  // window.location.reload() can't be mocked in the test environment
  it.skip('should refresh the browser');

  it('should reboot the device', async () => {
    await machine.reboot();
    expect(reboot).toHaveBeenCalled();
  });
});
