import { DeviceInfo, BrowserMachine } from '@castmill/device';
import { LegacyMachine, PING_INTERVAL } from './legacy-machine';
import { simpleHash } from './utils';
import { version } from '../../package.json';
import {
  getEnvironment,
  reboot,
  restart,
  updatePlayer,
  sendHeartbeat,
  sendPlayerReady,
} from '../electron-legacy-api';

export class ElectronLegacyMachine
  extends BrowserMachine
  implements LegacyMachine
{
  initLegacy(): void {
    setInterval(() => {
      console.log('Sending heartbeat');
      sendHeartbeat();
    }, PING_INTERVAL);

    setTimeout(() => {
      sendPlayerReady();
    }, 1000);
  }

  async getBaseUrl(): Promise<string | null> {
    const baseUrl = await super.getBaseUrl();

    if (!baseUrl) {
      console.log('legacy:getBaseUrl, baseUrl is not set');
      const additionalBaseUrls = await this.getAdditionalBaseUrls();
      console.log('legacy:getBaseUrl, additionalBaseUrls', additionalBaseUrls);
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
    console.log('legacy-electron:getMachineGUID');
    const environment = await getEnvironment();
    console.log('legacy-electron environment', environment);
    return environment.deviceId;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    console.log('legacy-electron:getDeviceInfo');
    // get chromium version from user agent
    const chromiumVersion =
      navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] ?? undefined;

    const environment = await getEnvironment();
    console.log(environment);

    return {
      appType: 'Electron legacy adapter',
      appVersion: environment.versionStr,
      os: 'Electrion',
      hardware: environment.model,
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