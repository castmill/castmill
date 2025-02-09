import { Device } from '@capacitor/device';
import { Toast } from '@capacitor/toast';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Machine, DeviceInfo, SettingKey } from '@castmill/device';
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
}
