import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  getNetworkInfo: vi.fn(),
  setNetworkInfo: vi.fn(),
  setPowerSaveMode: vi.fn(),
}));

vi.mock('../native', () => ({
  deviceInfo: {
    getNetworkInfo: native.getNetworkInfo,
    get setNetworkInfo() {
      return native.setNetworkInfo;
    },
  },
  signage: { setPowerSaveMode: native.setPowerSaveMode },
}));

import { deviceInfo } from '../native';
import {
  NETWORK_CHECK_INTERVAL_MS,
  NETWORK_RECONNECT_DELAY_MS,
  NetworkWatchdog,
  disableAutoStandby,
  startDisplayMaintenance,
} from './display-maintenance';

const networkInfo = (online: boolean) => ({
  isInternetConnectionAvailable: online,
  wired: { enabled: true, method: 'dhcp' },
  wifi: { enabled: true, method: 'dhcp' },
});

beforeEach(() => {
  vi.useFakeTimers();
  native.setPowerSaveMode.mockResolvedValue(undefined);
  native.setNetworkInfo.mockResolvedValue(undefined);
  native.getNetworkInfo.mockResolvedValue(networkInfo(true));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('disableAutoStandby', () => {
  it('turns off every LG power-saving standby mode', async () => {
    await disableAutoStandby();
    expect(native.setPowerSaveMode).toHaveBeenCalledWith({
      powerSaveMode: {
        ses: true,
        dpmMode: 'off',
        automaticStandby: 'off',
        do15MinOff: false,
      },
    });
  });
});

describe('NetworkWatchdog', () => {
  it('does nothing while the internet is reachable', async () => {
    const watchdog = new NetworkWatchdog();
    await watchdog.check();
    await watchdog.check();
    expect(native.setNetworkInfo).not.toHaveBeenCalled();
  });

  it('toggles the adapters after two consecutive offline checks', async () => {
    native.getNetworkInfo.mockResolvedValue(networkInfo(false));
    const watchdog = new NetworkWatchdog();
    await watchdog.check();
    expect(native.setNetworkInfo).not.toHaveBeenCalled();

    const check = watchdog.check();
    await vi.advanceTimersByTimeAsync(0);
    expect(native.setNetworkInfo).toHaveBeenCalledTimes(1);
    expect(native.setNetworkInfo).toHaveBeenLastCalledWith({
      isInternetConnectionAvailable: false,
      wired: { enabled: false, method: 'dhcp' },
      wifi: { enabled: false, method: 'dhcp' },
    });
    // Further checks are ignored while reconnecting.
    await watchdog.check();
    expect(native.getNetworkInfo).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(NETWORK_RECONNECT_DELAY_MS);
    await check;
    expect(native.setNetworkInfo).toHaveBeenCalledTimes(2);
    expect(native.setNetworkInfo).toHaveBeenLastCalledWith({
      isInternetConnectionAvailable: false,
      wired: { enabled: true, method: 'dhcp' },
      wifi: { enabled: true, method: 'dhcp' },
    });
  });

  it('resets the offline count when the connection recovers', async () => {
    const watchdog = new NetworkWatchdog();
    native.getNetworkInfo.mockResolvedValueOnce(networkInfo(false));
    await watchdog.check();
    await watchdog.check();
    native.getNetworkInfo.mockResolvedValueOnce(networkInfo(false));
    await watchdog.check();
    expect(native.setNetworkInfo).not.toHaveBeenCalled();
  });

  it('re-enables adapters even if disabling fails', async () => {
    native.getNetworkInfo.mockResolvedValue(networkInfo(false));
    native.setNetworkInfo.mockRejectedValueOnce(new Error('denied'));
    const watchdog = new NetworkWatchdog();
    await watchdog.check();
    await watchdog.check();
    expect(native.setNetworkInfo).toHaveBeenCalledTimes(2);
    expect(native.setNetworkInfo.mock.calls[1][0].wired.enabled).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      'WebOS network reconnect failed',
      expect.any(Error)
    );
  });

  it('skips reconnecting when SCAP cannot change network settings', async () => {
    native.getNetworkInfo.mockResolvedValue(networkInfo(false));
    const descriptor = Object.getOwnPropertyDescriptor(
      deviceInfo,
      'setNetworkInfo'
    )!;
    Object.defineProperty(deviceInfo, 'setNetworkInfo', {
      configurable: true,
      get: () => undefined,
    });
    try {
      const watchdog = new NetworkWatchdog();
      await watchdog.check();
      await watchdog.check();
      expect(native.setNetworkInfo).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(deviceInfo, 'setNetworkInfo', descriptor);
    }
  });

  it('logs failed network checks without reconnecting', async () => {
    native.getNetworkInfo.mockRejectedValue(new Error('unavailable'));
    const watchdog = new NetworkWatchdog();
    await watchdog.check();
    await watchdog.check();
    expect(native.setNetworkInfo).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'WebOS network check failed',
      expect.any(Error)
    );
  });

  it('checks periodically until stopped', async () => {
    const watchdog = new NetworkWatchdog();
    watchdog.start();
    watchdog.start();
    await vi.advanceTimersByTimeAsync(NETWORK_CHECK_INTERVAL_MS * 2);
    expect(native.getNetworkInfo).toHaveBeenCalledTimes(2);
    watchdog.stop();
    watchdog.stop();
    await vi.advanceTimersByTimeAsync(NETWORK_CHECK_INTERVAL_MS);
    expect(native.getNetworkInfo).toHaveBeenCalledTimes(2);
  });
});

describe('startDisplayMaintenance', () => {
  it('disables standby, starts the watchdog and stops it on cleanup', async () => {
    const watchdog = new NetworkWatchdog();
    const start = vi.spyOn(watchdog, 'start');
    const stop = vi.spyOn(watchdog, 'stop');
    const cleanup = startDisplayMaintenance(watchdog);
    expect(native.setPowerSaveMode).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    cleanup();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('keeps running when power-save settings fail', async () => {
    native.setPowerSaveMode.mockRejectedValue(new Error('denied'));
    const cleanup = startDisplayMaintenance();
    await vi.advanceTimersByTimeAsync(0);
    expect(console.error).toHaveBeenCalledWith(
      'Failed to disable WebOS automatic standby',
      expect.any(Error)
    );
    cleanup();
  });
});
