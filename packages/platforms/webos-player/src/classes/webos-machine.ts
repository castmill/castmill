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
import { configuration, deviceInfo, power, storage } from '../native';
import { sha256 } from 'js-sha256';
import { getTimers, setTimers } from './utils';
import { version } from '../../package.json';
import { systemMonitor } from './system-monitor';

const KIB = 1024;
const LOCATION_TIMEOUT_MS = 10_000;
// Matches the old WebOS player's 1 GB requirement for firmware downloads.
export const REQUIRED_FIRMWARE_FREE_KB = 1024 * 1024;
export const FIRMWARE_STATUS_POLL_MS = 5_000;
export const FIRMWARE_DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// The update config is used to update the application on the device. We set this
// to make sure the application updates from the correct source.
// The update URL is injected at build time via the VITE_UPDATE_URL env variable.
const getUpdateConfig = () => ({
  serverIp: '0.0.0.0',
  serverPort: 0,
  secureConnection: true,
  appLaunchMode: 'local',
  appType: 'ipk',
  fqdnMode: true,
  fqdnAddr: import.meta.env.VITE_UPDATE_URL,
});

const CREDENTIALS_FILE_PATH = 'credentials.txt';

const getFilePath = (path: string) => `file://internal/${path}`;

export class WebosMachine implements Machine {
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
    return {
      appType: 'LG WebOS',
      appVersion: version,
      os: 'LG WebOS',
      hardware: platformInfo.modelName,
      environmentVersion: platformInfo.firmwareVersion,
      chromiumVersion,
      userAgent: navigator.userAgent,
    };
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
   * Updates the device's application.
   */
  async update(): Promise<void> {
    const keepServerSettings =
      import.meta.env.VITE_KEEP_SERVER_SETTINGS === 'true';
    if (!keepServerSettings) {
      // Set the server properties to the correct values
      await configuration.setServerProperty(getUpdateConfig());
    }

    // Then download the application
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
      const { wired, wifi } = await deviceInfo.getNetworkInfo();
      if (wired?.state === 'connected') {
        telemetry.network = { type: 'ethernet', ipAddress: wired.ipAddress };
      } else if (wifi?.state === 'connected') {
        telemetry.network = { type: 'wifi', ipAddress: wifi.ipAddress };
      }
    } catch (error) {
      console.error('Error getting network info:', error);
    }

    return telemetry;
  }
}
