import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebosLegacyMachine } from './webos-legacy-machine';
import { PING_INTERVAL } from './legacy-machine';
import {
  getWebosMachineGUID,
  sendHeartbeat,
  sendPlayerReady,
  initWebosLegacyApi,
} from '../webos-legacy-api';

vi.mock('../webos-legacy-api', () => ({
  initWebosLegacyApi: vi.fn(),
  getWebosMachineGUID: vi.fn(),
  sendHeartbeat: vi.fn(),
  sendPlayerReady: vi.fn(),
}));

describe('WebosLegacyMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getWebosMachineGUID).mockResolvedValue('webos-device-id');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('uses the existing wrapper hardware identifier', async () => {
    const machine = new WebosLegacyMachine();
    expect(await machine.getMachineGUID()).toBe('webos-device-id');
    expect(getWebosMachineGUID).toHaveBeenCalledOnce();
  });

  it('rejects an invalid hardware identifier', async () => {
    vi.mocked(getWebosMachineGUID).mockResolvedValue('');
    await expect(new WebosLegacyMachine().getMachineGUID()).rejects.toThrow(
      'WebOS wrapper returned an invalid machine ID'
    );
  });

  it('starts heartbeats before readiness and notifies only after mounting', () => {
    const machine = new WebosLegacyMachine();
    machine.initLegacy();
    expect(initWebosLegacyApi).toHaveBeenCalledOnce();
    expect(sendHeartbeat).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(sendPlayerReady).not.toHaveBeenCalled();
    machine.notifyReady();
    vi.advanceTimersByTime(1000);
    expect(sendPlayerReady).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(PING_INTERVAL - 2000);
    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
  });
});
