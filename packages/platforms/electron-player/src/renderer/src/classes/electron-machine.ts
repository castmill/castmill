import { Machine, DeviceInfo } from '@castmill/device';

export class ElectronMachine implements Machine {
  async getMachineGUID(): Promise<string> {
    return window.api.getMachineGUID();
  }

  async storeCredentials(credentials: string): Promise<void> {
    window.api.setItem('castmill-credentials', credentials);
  }

  async getCredentials(): Promise<string> {
    return window.api.getItem('castmill-credentials');
  }

  async removeCredentials(): Promise<void> {
    window.api.deleteItem('castmill-credentials');
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
    const versions = window.electron.process.versions;

    return {
      appType: import.meta.env.VITE_APP_TYPE,
      appVersion: window.electron.process.env.npm_package_version,
      os: `${window.osInfo.type} ${window.osInfo.release}`,
      hardware: await window.hardwareInfo(),
      environmentVersion: versions.electron,
      chromiumVersion: versions.chrome,
      v8Version: versions.v8,
      nodeVersion: versions.node,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Restart the device application.
   */
  async restart(): Promise<void> {
    window.api.relaunch();
  }

  /**
   * Quit the device application.
   */
  async quit(): Promise<void> {
    window.api.quit();
  }

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  async reboot(): Promise<void> {
    window.api.reboot();
  }

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  async shutdown(): Promise<void> {
    window.api.shutdown();
  }

  /**
   * Updates the device's application.
   */
  async update(): Promise<void> {
    window.api.update();
  }
}
