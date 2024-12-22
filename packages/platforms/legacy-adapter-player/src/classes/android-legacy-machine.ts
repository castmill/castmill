import { DeviceInfo, SettingKey } from '@castmill/device';
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

import { Logger } from '../utils';

const logger = new Logger('LegacyMachine');

// The default value for unset values in the android settings
export const UNSET_VALUE = 'YES';

export class AndroidLegacyMachine implements LegacyMachine {
  initLegacy(): void {
    setInterval(() => {
      logger.log('Sending heartbeat');
      sendHeartbeat();
    }, PING_INTERVAL);

    setTimeout(() => {
      sendPlayerReady();
    }, 1000);
  }

  private async setItem(key: string, value: string): Promise<void> {
    logger.log('setItem', key, value);
    return setItem(key, value);
  }

  private async getItem(key: string): Promise<string | null> {
    logger.log('getItem', key);
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

  async setSetting(key: SettingKey, value: string): Promise<void> {
    logger.log('setSetting');
    await this.setItem(key, value);
  }

  async getSetting(key: SettingKey): Promise<string | null> {
    const value = await this.getItem(key);

    logger.log('getSetting', key, value);

    return value;
  }

  async getMachineGUID(): Promise<string> {
    const playerData = await getPlayerData();
    logger.log('getMachineGUID', playerData);
    return playerData.uuid;
  }

  async storeCredentials(credentials: string): Promise<void> {
    logger.log('storeCredentials');
    await this.setItem('CREDENTIALS', credentials);
  }

  async getCredentials(): Promise<string | null> {
    logger.log('getCredentials');
    const credentials = await this.getItem('CREDENTIALS');

    return credentials;
  }

  async removeCredentials(): Promise<void> {
    logger.log('removeCredentials');
    this.removeItem('CREDENTIALS');
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    logger.log('getLocation');
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
    logger.log('getTimezone');
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    logger.log('getDeviceInfo');
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
    logger.log('restart');
    return restart();
  }

  /**
   * Refresh the browser.
   */
  async refresh(): Promise<void> {
    logger.log('refresh');
    return window.location.reload();
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    logger.log('reboot');
    return reboot();
  }
}
