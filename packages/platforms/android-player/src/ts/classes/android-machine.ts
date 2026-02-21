import { Device } from '@capacitor/device';
import { Toast } from '@capacitor/toast';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import {
  Machine,
  DeviceInfo,
  SettingKey,
  TelemetryData,
} from '@castmill/device';
import { Castmill } from '../../plugins/castmill';
import { delay } from '../utils';

export class AndroidMachine implements Machine {
  async setSetting(key: SettingKey, value: string): Promise<void> {
    await Preferences.set({
      key,
      value,
    });
  }

  async getSetting(key: SettingKey): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async getMachineGUID(): Promise<string> {
    const deviceId = await Device.getId();
    return deviceId.identifier;
  }

  async storeCredentials(credentials: string): Promise<void> {
    await Preferences.set({
      key: 'credentials',
      value: credentials,
    });
  }

  async getCredentials(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'credentials' });
    return value;
  }

  async removeCredentials(): Promise<void> {
    await Preferences.remove({ key: 'credentials' });
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    try {
      const location = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }
      );

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error(`Error getting location: ${error}`);
      return undefined;
    }
  }

  async getTimezone(): Promise<string> {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    let appInfo;
    try {
      appInfo = await App.getInfo();
    } catch (error) {
      console.error(
        `Error getting app info. This is expoected when running in a browser: ${error}`
      );
      // App plugin not available
      // This is the case when running in a browser
      appInfo = { version: 'N/A' };
    }
    const deviceInfo = await Device.getInfo();

    return {
      appType: deviceInfo.platform,
      appVersion: appInfo.version,
      os: deviceInfo.operatingSystem,
      hardware: deviceInfo.model,
      environmentVersion: deviceInfo.osVersion,
      chromiumVersion: deviceInfo.webViewVersion,
      // v8Version: '1',
      // nodeVersion: '1',
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Restart the device application.
   */
  async restart(): Promise<void> {
    Toast.show({
      text: 'About to restart',
    });

    await delay(3000);

    return Castmill.restart();
  }

  /**
   * Quit the device application.
   */
  async quit(): Promise<void> {
    Toast.show({
      text: 'About to quit',
    });

    await delay(3000);

    return Castmill.quit();
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    Toast.show({
      text: 'About to reboot',
    });

    await delay(3000);

    return Castmill.reboot();
  }

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  async shutdown(): Promise<void> {
    //TODO: Implement
    console.log('Shutdown');
  }

  /**
   * Updates the device's application.
   */
  async update(): Promise<void> {
    //TODO: Implement
    console.log('Update');
  }

  /**
   * Returns telemetry data from the Android device.
   * Uses Capacitor Device plugin for disk, memory, and battery info.
   */
  async getTelemetry(): Promise<TelemetryData> {
    const telemetry: TelemetryData = {};

    try {
      const info = await Device.getInfo();

      // Storage info
      if (info.realDiskTotal !== undefined && info.realDiskFree !== undefined) {
        const totalBytes = info.realDiskTotal;
        const freeBytes = info.realDiskFree;
        telemetry.storage = {
          totalBytes,
          usedBytes: totalBytes - freeBytes,
        };
      } else if (info.diskTotal !== undefined && info.diskFree !== undefined) {
        telemetry.storage = {
          totalBytes: info.diskTotal,
          usedBytes: info.diskTotal - info.diskFree,
        };
      }

      // Memory info
      if (info.memUsed !== undefined) {
        // Capacitor only provides memUsed on Android, total memory isn't directly available
        telemetry.memory = {
          totalBytes: 0, // Not available via Capacitor
          usedBytes: info.memUsed,
        };
      }
    } catch (error) {
      console.error('Error getting device info for telemetry:', error);
    }

    // Battery info
    try {
      const batteryInfo = await Device.getBatteryInfo();
      if (batteryInfo.batteryLevel !== undefined) {
        telemetry.battery = {
          levelPercent: Math.round(batteryInfo.batteryLevel * 100),
          isCharging: batteryInfo.isCharging ?? false,
        };
      }
    } catch (error) {
      console.error('Error getting battery info:', error);
    }

    // Network info via Navigator API
    try {
      const connection = (navigator as any).connection;
      if (connection) {
        telemetry.network = {
          type: connection.type || connection.effectiveType || undefined,
        };
      }
    } catch (error) {
      console.error('Error getting network info:', error);
    }

    return telemetry;
  }
}
