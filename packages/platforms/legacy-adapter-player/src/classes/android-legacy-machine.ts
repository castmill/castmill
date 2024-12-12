import { DeviceInfo } from '@castmill/device';
import { LegacyMachine, PING_INTERVAL } from './legacy-machine';
import { simpleHash } from './utils';
import { version } from '../../package.json';
import {
  getPlayerData,
  getItem,
  setItem,
  reboot,
  restart,
  sendHeartbeat,
  sendPlayerReady,
} from '../android-legacy-api';

// The default value for unset values in the android settings
export const UNSET_VALUE = 'YES';

export class AndroidLegacyMachine implements LegacyMachine {
  initLegacy(): void {
    setInterval(() => {
      console.log('Sending heartbeat');
      sendHeartbeat();
    }, PING_INTERVAL);

    setTimeout(() => {
      sendPlayerReady();
    }, 1000);
  }

  private async setItem(key: string, value: string): Promise<void> {
    console.log('setItem', key, value);
    return setItem(key, value);
  }

  private async getItem(key: string): Promise<string | null> {
    console.log('legacy:getItem ' + key);
    const value = await getItem(key);
    if (value === UNSET_VALUE) {
      // If the value is unset
      return null;
    }
    return value;
  }

  private async removeItem(key: string): Promise<void> {
    return setItem(key, UNSET_VALUE);
  }

  async setBaseUrl(baseUrl: string): Promise<void> {
    console.log('legacy:setBaseUrl');
    await this.setItem('BASE_URL', baseUrl);
  }

  async getBaseUrl(): Promise<string | null> {
    console.log('legacy:getBaseUrl');
    const baseUrl = await this.getItem('BASE_URL');

    console.log(`legacy:getBaseUrl, baseUrl: ${baseUrl}`);

    if (!baseUrl) {
      const additionalBaseUrls = await this.getAdditionalBaseUrls();
      return additionalBaseUrls[0]?.url;
    }

    return baseUrl;
  }

  async getAdditionalBaseUrls(): Promise<{ name: string; url: string }[]> {
    const localBaseUrl = import.meta.env.VITE_BASE_URL;
    console.log('localBaseUrl', localBaseUrl);

    if (localBaseUrl) {
      return [
        {
          name: 'Local',
          url: localBaseUrl,
        },
      ];
    } else {
      return [];
    }
  }

  async getMachineGUID(): Promise<string> {
    console.log('legacy:getMachineGUID');
    const playerData = await getPlayerData();
    console.log('playerData', playerData);
    return playerData.uuid;
  }

  async storeCredentials(credentials: string): Promise<void> {
    console.log('legacy:storeCredentials');
    await this.setItem('CREDENTIALS', credentials);
  }

  async getCredentials(): Promise<string | null> {
    console.log('legacy:getCredentials');
    const credentials = await this.getItem('CREDENTIALS');

    return credentials;
  }

  async removeCredentials(): Promise<void> {
    console.log('legacy:removeCredentials');
    this.removeItem('CREDENTIALS');
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    console.log('legacy:getLocation');
    return undefined;
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
    console.log('legacy:getTimezone');
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    console.log('legacy:getDeviceInfo');
    // get chromium version from user agent
    const chromiumVersion =
      navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] ?? undefined;

    const playerData = await getPlayerData();

    return {
      appType: 'Legacy adapter',
      appVersion: playerData.player_version,
      os: 'Legacy adapter',
      hardware: playerData.model,
      chromiumVersion,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Restart the device application.
   */
  async restart(): Promise<void> {
    console.log('legacy:restart');
    return restart();
  }

  /**
   * Refresh the browser.
   */
  async refresh(): Promise<void> {
    console.log('legacy:refresh');
    return window.location.reload();
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    console.log('legacy:reboot');
    return reboot();
  }
}
