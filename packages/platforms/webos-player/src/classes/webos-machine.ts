import {
  Machine,
  DeviceInfo,
  SettingKey,
  Timers,
  TelemetryData,
  Orientation,
  OrientationResult,
} from '@castmill/device';
import {
  applyWebosOrientation,
  setWebosNativeOrientation,
} from '../shared/orientation';
import { getNativePortraitApi } from '../native/orientation';
import { getWebosVersion } from '../native/webos-version';
import { configuration, deviceInfo, power, storage } from '../native';
import { sha256 } from 'js-sha256';
import { getTimers, setTimers } from './utils';
import { version } from '../../package.json';
import { systemMonitor } from './system-monitor';

const KIB = 1024;
/** Interval between the two CPU samples taken when no earlier sample exists. */
export const CPU_SAMPLE_INTERVAL_MS = 1_000;
const LOCATION_TIMEOUT_MS = 10_000;
// Matches the old WebOS player's 1 GB requirement for firmware downloads.
export const REQUIRED_FIRMWARE_FREE_KB = 1024 * 1024;
export const FIRMWARE_STATUS_POLL_MS = 5_000;
export const FIRMWARE_DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const CREDENTIALS_FILE_PATH = 'credentials.txt';

const getFilePath = (path: string) => `file://internal/${path}`;

interface CpuSample {
  idle: number;
  total: number;
}

const toCpuSample = (cpus: SystemUsageInfo['cpus']): CpuSample | undefined => {
  if (!cpus?.length) return;
  let idle = 0;
  let total = 0;
  for (const { times } of cpus) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return Number.isFinite(total) && total > 0 ? { idle, total } : undefined;
};

export class WebosMachine implements Machine {
  private lastCpuSample?: CpuSample;

  async setOrientation(orientation: Orientation): Promise<OrientationResult> {
    const api = getNativePortraitApi();
    return applyWebosOrientation(
      orientation,
      api ? (angle) => setWebosNativeOrientation(angle, api) : undefined
    );
  }

  async setSetting(key: SettingKey, value: string): Promise<void> {
    await storage.writeFile({
      path: getFilePath(`castmill-${key}.txt`),
      data: value,
    });
  }

  async getSetting(key: SettingKey): Promise<string | null> {
    try {
      const file = await storage.readFile({
        path: getFilePath(`castmill-${key}.txt`),
      });

      return file.data.toString();
    } catch {
      return null;
    }
  }

  async getMachineGUID(): Promise<string> {
    const { wiredInfo, wifiInfo } = await deviceInfo.getNetworkMacInfo();
    const macAddress = wiredInfo?.macAddress || wifiInfo?.macAddress;
    if (!macAddress) {
      throw new Error('No mac address found');
    }

    // Same identifier as the old WebOS wrapper used by the legacy adapter, so
    // displays migrating to this app keep their Castmill registration.
    return sha256(macAddress);
  }

  async storeCredentials(credentials: string): Promise<void> {
    await storage.writeFile({
      path: getFilePath(CREDENTIALS_FILE_PATH),
      data: credentials,
    });
    return;
  }

  async getCredentials(): Promise<string | null> {
    try {
      const credentials = await storage.readFile({
        path: getFilePath(CREDENTIALS_FILE_PATH),
      });

      return credentials.data.toString();
    } catch {
      return null;
    }
  }

  async removeCredentials(): Promise<void> {
    return storage.removeFile({
      file: getFilePath(CREDENTIALS_FILE_PATH),
    });
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    try {
      // Registration waits for this, so never let geolocation hang.
      const location = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Geolocation timed out')),
            LOCATION_TIMEOUT_MS
          );
          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timer);
              resolve(position);
            },
            (error) => {
              clearTimeout(timer);
              reject(error);
            },
            { timeout: LOCATION_TIMEOUT_MS, maximumAge: Infinity }
          );
        }
      );

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error(`Failed to get location: ${error}`);
      return undefined;
    }
  }

  async getTimezone(): Promise<string> {
    // Chrome 38 (webOS 3.x) may not resolve the default time zone.
    const intlTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (intlTimezone) return intlTimezone;
    try {
      const { timeZone } = await configuration.getTimeZone();
      if (timeZone?.continent && timeZone.city) {
        return `${timeZone.continent}/${timeZone.city}`.replace(/ /g, '_');
      }
    } catch (error) {
      console.error('Failed to get WebOS time zone', error);
    }
    return 'UTC';
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const platformInfo = await deviceInfo.getPlatformInfo();
    // get chromium version from user agent
    const chromiumVersion =
      navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] ?? undefined;
    let webosVersion: string | undefined;
    try {
      webosVersion = await getWebosVersion();
    } catch (error) {
      console.error('Failed to get webOS version', error);
    }
    return {
      appType: 'LG WebOS',
      appVersion: version,
      os: webosVersion ? `LG WebOS ${webosVersion}` : 'LG WebOS',
      hardware: platformInfo.modelName,
      environmentVersion: platformInfo.firmwareVersion,
      chromiumVersion,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Clears the display's browser cache, as the old WebOS wrapper's
   * "clear cache" command did. Credentials and settings live in
   * file://internal and are not affected.
   */
  async clearCache(): Promise<void> {
    return configuration.clearCache();
  }

  /**
   * Restart the device application.
   */
  async restart(): Promise<void> {
    return configuration.restartApplication();
  }

  /**
   * Refresh the browser.
   */
  async refresh(): Promise<void> {
    return window.location.reload();
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    return power.executePowerCommand({
      powerCommand: 'reboot',
    });
  }

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  async shutdown(): Promise<void> {
    return power.executePowerCommand({
      powerCommand: 'powerOff',
    });
  }

  /**
   * Updates the device's application from the update server already
   * configured on the display (SCAP server settings, e.g. set through the
   * display's installer menu or SuperSign). The player does not change it.
   */
  async update(): Promise<void> {
    await storage.upgradeApplication({
      type: 'ipk',
      to: 'local',
      recovery: true,
    });

    // Reboot the device to apply the update
    return this.reboot();
  }

  /**
   * Updates the device's firmware.
   */
  async updateFirmware(): Promise<void> {
    const url = await this.getFirmwareDownloadUrl();

    const { free } = await storage.getStorageInfo();
    if (!(free >= REQUIRED_FIRMWARE_FREE_KB)) {
      throw new Error('Not enough free space for firmware upgrade');
    }

    // The firmware is downloaded to the device's temporary storage. It will be
    // deleted automatically after the device reboots.
    await storage.downloadFirmware({
      uri: url,
    });
    await this.waitForFirmwareDownload();

    // Trigger the firmware upgrade. The display reboots when it completes.
    return storage.upgradeFirmware();
  }

  private async waitForFirmwareDownload(): Promise<void> {
    const deadline = Date.now() + FIRMWARE_DOWNLOAD_TIMEOUT_MS;
    for (;;) {
      const { status } = await storage.getFirmwareUpgradeStatus();
      if (status === 'ready') return;
      if (status === 'fail') {
        throw new Error('Firmware download failed');
      }
      if (status !== 'downloading') {
        throw new Error(`Unexpected firmware status: ${status}`);
      }
      if (Date.now() >= deadline) {
        throw new Error('Firmware download timed out');
      }
      await sleep(FIRMWARE_STATUS_POLL_MS);
    }
  }

  /**
   * Firmware images are hosted per exact model, using the same convention as
   * the old WebOS wrapper:
   * `https://update.castmill.io/webos/firmware/{manufacturer}-{modelName}.epk`,
   * where both values come from SCAP `DeviceInfo.getPlatformInfo` (for example
   * `LG-55XS2E-BH.epk`). The host is fixed and independent of the display's
   * application update server. See "Firmware updates" in the README.
   */
  async getFirmwareDownloadUrl(): Promise<string> {
    const { manufacturer, modelName } = await deviceInfo.getPlatformInfo();

    // TODO: Model name is probably too specific, we should use the model family instead
    // e.g. 'XS2E' instead of '55XS2E-BH'
    const url = `https://update.castmill.io/webos/firmware/${manufacturer}-${modelName}.epk`;
    return url;
  }

  async getTimers(): Promise<Timers> {
    return getTimers();
  }

  async setTimers(timers: Timers): Promise<void> {
    return setTimers(timers);
  }

  /**
   * Returns telemetry data from the WebOS signage display.
   * Uses SCAP APIs for storage, temperature, and fan status.
   */
  async getTelemetry(): Promise<TelemetryData> {
    const telemetry: TelemetryData = {};

    // Storage info via SCAP Storage API
    try {
      const storageInfo = await storage.getStorageInfo();
      if (storageInfo) {
        // SCAP reports total/used/free in KB.
        telemetry.storage = {
          totalBytes: storageInfo.total * KIB,
          usedBytes: storageInfo.used * KIB,
        };
      }
    } catch (error) {
      console.error('Error getting storage info:', error);
    }

    // Temperature and fan status via System Monitor
    try {
      // Ensure system monitor is running
      if (!systemMonitor.isMonitoring()) {
        await systemMonitor.start();
      }

      const tempInfo = systemMonitor.getTemperature();
      if (tempInfo && tempInfo.temperature !== undefined) {
        telemetry.temperatures = [
          { label: 'Panel', celsius: tempInfo.temperature },
        ];
      }

      // SCAP may report only a fan status; never present that as 0 RPM.
      const fanSpeeds = (systemMonitor.getFanStatus()?.fanStatus ?? [])
        .map((fan, index) => ({
          label: fan.name || `Fan ${index + 1}`,
          rpm: fan.rpm,
        }))
        .filter((fan): fan is { label: string; rpm: number } =>
          Number.isFinite(fan.rpm)
        );
      if (fanSpeeds.length > 0) {
        telemetry.fanSpeeds = fanSpeeds;
      }
    } catch (error) {
      console.error('Error getting system monitor data:', error);
    }

    try {
      const usage = await this.getSystemUsage();
      const memory = usage?.memory;
      if (
        memory &&
        Number.isFinite(memory.total) &&
        Number.isFinite(memory.free) &&
        memory.total > 0
      ) {
        // SCAP reports memory in bytes.
        telemetry.memory = {
          totalBytes: memory.total,
          usedBytes: Math.max(0, memory.total - memory.free),
        };
      }
      const cpuUsagePercent = await this.getCpuUsagePercent(usage);
      if (cpuUsagePercent !== undefined) {
        telemetry.cpuUsagePercent = cpuUsagePercent;
      }
    } catch (error) {
      console.error('Error getting system usage:', error);
    }

    try {
      const { wired, wifi } = await deviceInfo.getNetworkInfo();
      if (wired?.state === 'connected') {
        telemetry.network = { type: 'ethernet', ipAddress: wired.ipAddress };
      } else if (wifi?.state === 'connected') {
        telemetry.network = {
          type: 'wifi',
          ipAddress: wifi.ipAddress,
          ...(await this.getConnectedWifi(wifi)),
        };
      }
    } catch (error) {
      console.error('Error getting network info:', error);
    }

    return telemetry;
  }

  private async getSystemUsage(): Promise<SystemUsageInfo | undefined> {
    return deviceInfo.getSystemUsageInfo?.({ cpus: true, memory: true });
  }

  /**
   * SCAP reports cumulative CPU times, so usage is the busy share between two
   * samples. Without an earlier sample a second one is taken shortly after.
   */
  private async getCpuUsagePercent(
    usage: SystemUsageInfo | undefined
  ): Promise<number | undefined> {
    let current = toCpuSample(usage?.cpus);
    if (!current) return;
    let previous = this.lastCpuSample;
    if (!previous || current.total <= previous.total) {
      previous = current;
      await sleep(CPU_SAMPLE_INTERVAL_MS);
      current = toCpuSample((await this.getSystemUsage())?.cpus);
      if (!current) return;
    }
    this.lastCpuSample = current;
    const total = current.total - previous.total;
    if (!(total > 0)) return;
    const busy = total - (current.idle - previous.idle);
    return Math.round(Math.min(100, Math.max(0, (busy / total) * 100)));
  }

  /**
   * SCAP's network info has no SSID, so the connected network is looked up in
   * the Wi-Fi scan list by its `connected` flag or the SSID some firmware adds.
   */
  private async getConnectedWifi(
    wifi: WirelessNetworkInfo & { ssid?: unknown }
  ): Promise<{ ssid?: string; wifiSignalStrengthPercent?: number }> {
    if (!deviceInfo.getWifiList) return {};
    try {
      const networks = (await deviceInfo.getWifiList()).networkInfo ?? [];
      const ssid = typeof wifi.ssid === 'string' ? wifi.ssid : undefined;
      const network =
        networks.find((entry) => entry.connected === true) ??
        (ssid ? networks.find((entry) => entry.ssid === ssid) : undefined);
      if (!network) return {};
      const signal = network.signalLevel;
      return {
        ...(network.ssid ? { ssid: network.ssid } : {}),
        ...(typeof signal === 'number' && Number.isFinite(signal)
          ? {
              wifiSignalStrengthPercent: Math.min(100, Math.max(0, signal)),
            }
          : {}),
      };
    } catch (error) {
      console.error('Error getting Wi-Fi list:', error);
      return {};
    }
  }
}
