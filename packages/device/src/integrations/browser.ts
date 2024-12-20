import {
  Machine,
  type DeviceInfo,
  type SettingKey,
} from '../interfaces/machine';

export class BrowserMachine implements Machine {
  async getSetting(key: SettingKey): Promise<string | null> {
    return localStorage.getItem(`castmill.${key}`);
  }

  async setSetting(key: SettingKey, value: string): Promise<void> {
    localStorage.setItem(`castmill.${key}`, value);
  }

  /**
   * Since a browser does not support a MAC address or another
   * persistent GUID, we will use a random UUID.
   */
  async getMachineGUID(): Promise<string> {
    let machineId = localStorage.getItem('machineId');
    if (!machineId) {
      machineId = crypto.randomUUID();
      localStorage.setItem('machineId', machineId);
    }
    return machineId;
  }

  async storeCredentials(credentials: string): Promise<void> {
    localStorage.setItem('castmill.credentials', credentials);
  }

  async getCredentials(): Promise<string> {
    return localStorage.getItem('castmill.credentials') || '';
  }

  async removeCredentials(): Promise<void> {
    localStorage.removeItem('castmill.credentials');
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
    return {
      appType: 'Browser',
      appVersion: '0.0.0-todo-hardcode',
      os: 'Browser dummy OS',
      hardware: 'Browser dummy',
      userAgent: navigator.userAgent,
    };
  }

  async restart(): Promise<void> {
    console.log('Refreshing the page');
    location.reload();
  }
}
