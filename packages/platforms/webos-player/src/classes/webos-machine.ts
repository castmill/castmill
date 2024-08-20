import { Machine, DeviceInfo } from '@castmill/device';
import { configuration, deviceInfo, power, storage } from '../native';
import { digestText } from './utils';
import { version } from '../../package.json';

// The update config is used to update the application on the device. We set this
// to make sure the application updates from the correct source.
var UPDATE_CONFIG = {
  serverIp: '0.0.0.0',
  serverPort: 0,
  secureConnection: true,
  appLaunchMode: 'local',
  appType: 'ipk',
  fqdnMode: true,
  fqdnAddr: 'https://update.castmill.io/webos/player-new.ipk',
};

var CREDENTIALS_FILE_PATH = 'credentials.txt';

export class WebosMachine implements Machine {
  async getMachineGUID(): Promise<string> {
    console.log('getMachineGUID');

    const { wiredInfo, wifiInfo } = await deviceInfo.getNetworkMacInfo();
    const macAddress = wiredInfo?.macAddress || wifiInfo?.macAddress;
    if (!macAddress) {
      throw new Error('No mac address found');
    }

    const hash = await digestText(macAddress);

    return hash;
  }

  async storeCredentials(credentials: string): Promise<void> {
    console.log('storeCredentials', credentials);
    await storage.writeFile({
      path: CREDENTIALS_FILE_PATH,
      data: credentials,
    });
    return;
  }

  async getCredentials(): Promise<string> {
    console.log('getCredentials');
    const credentials = await storage.readFile({
      path: CREDENTIALS_FILE_PATH,
    });

    return credentials.data.toString();
  }

  async removeCredentials(): Promise<void> {
    console.log('removeCredentials');
    return storage.removeFile({
      file: CREDENTIALS_FILE_PATH,
    });
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    // TODO: Check if this works on LG
    console.log('getLocation');
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
    console.log('getTimezone');
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    console.log('getDeviceInfo');

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
    console.log('restart');
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
    console.log('reboot');
    return power.executePowerCommand({
      powerCommand: 'reboot',
    });
  }

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  async shutdown(): Promise<void> {
    console.log('shutdown');
    return power.executePowerCommand({
      powerCommand: 'powerOff',
    });
  }

  /**
   * Updates the device's application.
   */
  async update(): Promise<void> {
    console.log('update');

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
    console.log('updateFirmware');

    const url = await this.getFirmwareDownloadUrl();

    await storage.downloadFirmware({
      uri: url,
    });

    return storage.upgradeFirmware();
  }

  private async getFirmwareDownloadUrl(): Promise<string> {
    const { manufacturer, modelName } = await deviceInfo.getPlatformInfo();

    // TODO: Model name is probably too specific, we should use the model family instead
    // e.g. 'XS2E' instead of '55XS2E-BH'
    const url = `https://update.castmill.io/webos/firmware/${manufacturer}-${modelName}.epk`;
    console.log('Firmware download URL:', url);
    return url;
  }
}
