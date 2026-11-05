import { deviceInfo, signage } from '../native';

export const NETWORK_CHECK_INTERVAL_MS = 10 * 60 * 1000;
export const NETWORK_RECONNECT_DELAY_MS = 10 * 1000;
/** Consecutive offline checks required before toggling the network. */
export const OFFLINE_CHECKS_BEFORE_RECONNECT = 2;

/**
 * Disables LG power saving that would otherwise turn the display off, e.g.
 * automatic standby after four hours without remote-control input. The old
 * WebOS wrapper applied this on every boot.
 */
export function disableAutoStandby(): Promise<void> {
  return signage.setPowerSaveMode({
    powerSaveMode: {
      ses: true,
      dpmMode: 'off',
      automaticStandby: 'off',
      do15MinOff: false,
    },
  });
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Recovers network adapters that remain without internet access by disabling
 * and re-enabling them, matching the old WebOS wrapper's connection checker.
 */
export class NetworkWatchdog {
  private timer?: ReturnType<typeof setInterval>;
  private offlineChecks = 0;
  private reconnecting = false;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.check(),
      NETWORK_CHECK_INTERVAL_MS
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.offlineChecks = 0;
  }

  async check(): Promise<void> {
    if (this.reconnecting) return;
    let online: boolean;
    try {
      online = (await deviceInfo.getNetworkInfo())
        .isInternetConnectionAvailable;
    } catch (error) {
      console.error('WebOS network check failed', error);
      return;
    }
    if (online) {
      this.offlineChecks = 0;
      return;
    }
    this.offlineChecks += 1;
    if (this.offlineChecks < OFFLINE_CHECKS_BEFORE_RECONNECT) return;
    this.offlineChecks = 0;
    await this.reconnect();
  }

  private async reconnect(): Promise<void> {
    const setNetworkInfo = deviceInfo.setNetworkInfo;
    if (!setNetworkInfo) return;
    this.reconnecting = true;
    console.warn('WebOS network has no internet access; reconnecting');
    try {
      // SCAP expects the complete configuration, so reuse the current one.
      const current = await deviceInfo.getNetworkInfo();
      const withEnabled = (enabled: boolean) => ({
        ...current,
        wired: { ...current.wired, enabled },
        wifi: { ...current.wifi, enabled },
      });
      try {
        await setNetworkInfo(withEnabled(false));
        await delay(NETWORK_RECONNECT_DELAY_MS);
      } finally {
        // Always re-enable, even if disabling failed part-way.
        await setNetworkInfo(withEnabled(true));
      }
    } catch (error) {
      console.error('WebOS network reconnect failed', error);
    } finally {
      this.reconnecting = false;
    }
  }
}

/** Applies boot-time display settings and starts long-running watchdogs. */
export function startDisplayMaintenance(
  watchdog: NetworkWatchdog = new NetworkWatchdog()
): () => void {
  disableAutoStandby().catch((error: unknown) =>
    console.error('Failed to disable WebOS automatic standby', error)
  );
  watchdog.start();
  return () => watchdog.stop();
}
