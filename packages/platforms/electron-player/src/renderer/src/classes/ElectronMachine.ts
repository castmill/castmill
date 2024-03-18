import { Machine, DeviceInfo } from '@castmill/device';

// get the version of the electron app from

export class ElectronMachine implements Machine {
  /**
   * Since a browser does not support a MAC address or another
   * persistent GUID, we will use a random UUID.
   *
   */
  async getMachineGUID(): Promise<string> {
    //TODO use a real hardware identifier
    let machineId = localStorage.getItem('machineId');
    if (!machineId) {
      machineId = crypto.randomUUID();
      localStorage.setItem('machineId', machineId);
    }
    return machineId;
  }

  async storeCredentials(credentials: string): Promise<void> {
    //TODO use a real storage
    localStorage.setItem('castmill.credentials', credentials);
  }

  async getCredentials(): Promise<string> {
    //TODO use a real storage
    return localStorage.getItem('castmill.credentials') || '';
  }

  async removeCredentials(): Promise<void> {
    //TODO use a real storage
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
    // const [versions] = createSignal(window.electron.process.versions)
    const versions = window.electron.process.versions;

    return {
      appType: import.meta.env.VITE_APP_TYPE,
      appVersion: window.electron.process.env.npm_package_version,
      os: 'Hardcode OS 12345',
      hardware: 'LG 42424242 dummy',
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
