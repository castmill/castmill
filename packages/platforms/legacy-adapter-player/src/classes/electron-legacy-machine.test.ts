import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { ElectronLegacyMachine } from './electron-legacy-machine';

vi.mock('../electron-legacy-api', () => ({
  getEnvironment: vi.fn().mockResolvedValue({
    deviceId: 'mocked_device_id',
    versionStr: 'mocked_version_str',
    model: 'mocked_model',
  }),
  reboot: vi.fn().mockResolvedValue(undefined),
  restart: vi.fn().mockResolvedValue(undefined),
  sendHeartbeat: vi.fn(),
  sendPlayerReady: vi.fn(),
}));

vi.mock('./utils', () => ({
  simpleHash: vi.fn((text: string) => Promise.resolve('hashed_' + text)),
}));

import {
  getEnvironment,
  reboot,
  restart,
  sendHeartbeat,
  sendPlayerReady,
} from '../electron-legacy-api';

describe('ElectronLegacyMachine', () => {
  let machine: ElectronLegacyMachine;

  beforeEach(() => {
    machine = new ElectronLegacyMachine();
  });

  it('should return machine GUID', async () => {
    const guid = await machine.getMachineGUID();
    expect(guid).toBe('mocked_device_id');
    expect(getEnvironment).toHaveBeenCalled();
  });

  it('should return device info', async () => {
    const info = await machine.getDeviceInfo();
    expect(info).toEqual({
      appType: 'Electron legacy adapter',
      appVersion: 'mocked_version_str',
      os: 'Electrion',
      hardware: 'mocked_model',
      chromiumVersion: undefined, // Since userAgent is not mocked in the test environment
      userAgent: navigator.userAgent,
    });
    expect(getEnvironment).toHaveBeenCalled();
  });

  it('should restart the application', async () => {
    await machine.restart();
    expect(restart).toHaveBeenCalled();
  });

  // window.location.reload() can't be mocked in the test environment
  it.skip('should refresh the application');

  it('should reboot the application', async () => {
    await machine.reboot();
    expect(reboot).toHaveBeenCalled();
  });

  it('should send heartbeat at intervals', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    machine.initLegacy();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(sendHeartbeat).not.toHaveBeenCalled(); // Verify heartbeat isn't sent immediately
    // Simulate interval execution
    const callback = setIntervalSpy.mock.calls[0][0] as Function;
    callback();
    expect(sendHeartbeat).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('should send player ready after a timeout', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    machine.initLegacy();
    expect(setTimeoutSpy).toHaveBeenCalled();
    const callback = setTimeoutSpy.mock.calls[0][0] as Function;
    callback();
    expect(sendPlayerReady).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
