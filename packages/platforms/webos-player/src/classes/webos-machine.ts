import { Machine, DeviceInfo } from '@castmill/device';

export class WebosMachine implements Machine {
  async getMachineGUID(): Promise<string> {
    console.log('getMachineGUID');
    return '123'
  }

  async storeCredentials(credentials: string): Promise<void> {
    console.log('storeCredentials', credentials);
  }

  async getCredentials(): Promise<string> {
    console.log('getCredentials');
    return 'credentials';
  }

  async removeCredentials(): Promise<void> {
    console.log('removeCredentials');
  }

  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
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
    return {
      appType: import.meta.env.VITE_APP_TYPE,
      appVersion: 'TODO version',
      os: 'TODO os',
      hardware: 'TODO hardware',
      environmentVersion: 'TODO environmentVersion',
      chromiumVersion: 'TODO chromiumVersion',
      v8Version: 'TODO v8Version',
      nodeVersion: 'TODO nodeVersion',
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Restart the device application.
   */
  async restart(): Promise<void> {
    console.log('restart');
  }

  /**
   * Quit the device application.
   */
  async quit(): Promise<void> {
    console.log('quit');
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    console.log('reboot');
  }

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  async shutdown(): Promise<void> {
    console.log('shutdown');
  }

  /**
   * Updates the device's application.
   */
  async update(): Promise<void> {
    console.log('update');
  }
}
