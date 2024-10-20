import { Machine, DeviceInfo } from '@castmill/device';
import { configuration, deviceInfo, power, storage } from '../native';
import { digestText } from './utils';
import { version } from '../../package.json';

// The update config is used to update the application on the device. We set this
// to make sure the application updates from the correct source.
const UPDATE_CONFIG = {
  serverIp: '0.0.0.0',
  serverPort: 0,
  secureConnection: true,
  appLaunchMode: 'local',
  appType: 'ipk',
  fqdnMode: true,
  fqdnAddr: 'https://update.castmill.io/webos/player-new.ipk',
};

const BASE_URL_FILE_PATH = 'base-url.txt';
const CREDENTIALS_FILE_PATH = 'credentials.txt';

export class WebosMachine implements Machine {
  async setBaseUrl(baseUrl: string): Promise<void> {
    await storage.writeFile({
      path: BASE_URL_FILE_PATH,
      data: baseUrl,
    });
    return;
  }

  async getBaseUrl(): Promise<string | null> {
    const file = await storage.readFile({
      path: BASE_URL_FILE_PATH,
    });

    return file.data.toString();
  }

  async getAdditionalBaseUrls(): Promise<{ name: string; url: string }[]> {
    return [];
  }

  async getMachineGUID(): Promise<string> {
    const { wiredInfo, wifiInfo } = await deviceInfo.getNetworkMacInfo();
    const macAddress = wiredInfo?.macAddress || wifiInfo?.macAddress;
    if (!macAddress) {
      throw new Error('No mac address found');
    }

    const hash = await digestText(macAddress);

    return hash;
  }

  async storeCredentials(credentials: string): Promise<void> {
    await storage.writeFile({
      path: CREDENTIALS_FILE_PATH,
      data: credentials,
    });
    return;
  }

  async getCredentials(): Promise<string> {
    const credentials = await storage.readFile({
      path: CREDENTIALS_FILE_PATH,
    });

    return credentials.data.toString();
  }

  async removeCredentials(): Promise<void> {
    return storage.removeFile({
      file: CREDENTIALS_FILE_PATH,
    });
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
    } catch (e) {
      return undefined;
    }
  }

  async getTimezone(): Promise<string> {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
   * Quit the device application.
   */
  async quit(): Promise<void> {
    console.error('Not supported on webOS.');
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
    // First set the server properties to the correct values
    await configuration.setServerProperty(UPDATE_CONFIG);

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

    // The firmware is downloaded to the device's temporary storage. It will be
    // deleted automatically after the device reboots.
    await storage.downloadFirmware({
      uri: url,
    });

    // Trigger the firmware upgrade.
    return storage.upgradeFirmware();

    // Reboot the device to apply the update. The downloaded firmware will be
    // deleted automatically after the reboot.
    return this.reboot();
  }

  private async getFirmwareDownloadUrl(): Promise<string> {
    const { manufacturer, modelName } = await deviceInfo.getPlatformInfo();

    // TODO: Model name is probably too specific, we should use the model family instead
    // e.g. 'XS2E' instead of '55XS2E-BH'
    const url = `https://update.castmill.io/webos/firmware/${manufacturer}-${modelName}.epk`;
    return url;
  }
}
