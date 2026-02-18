import { Machine, DeviceInfo, SettingKey } from '@castmill/device';

export class ElectronMachine implements Machine {
  async setSetting(key: SettingKey, value: string): Promise<void> {
    await window.api.setItem(`castmill-${key}`, value);
  }

  async getSetting(key: SettingKey): Promise<string | null> {
    return window.api.getItem(`castmill-${key}`);
  }

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

  /**
   * Get the device's location using the browser's native Geolocation API.
   * Requires VITE_GOOGLE_API_KEY to be set at build time so that Chromium's
   * network location provider can authenticate with Google's service.
   * Returns undefined if geolocation fails or is unavailable.
   */
  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    try {
      const TIMEOUT_MS = 3000; // 3 seconds

      const position = await Promise.race<GeolocationPosition>([
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: TIMEOUT_MS,
            maximumAge: 0,
            enableHighAccuracy: false,
          });
        }),
        new Promise<GeolocationPosition>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Geolocation request timed out'));
          }, TIMEOUT_MS + 1000);
        }),
      ]);

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const geoError = error as GeolocationPositionError;
        const errorMessages = {
          [GeolocationPositionError.PERMISSION_DENIED]:
            'Geolocation permission denied',
          [GeolocationPositionError.POSITION_UNAVAILABLE]:
            'Position unavailable (is VITE_GOOGLE_API_KEY set?)',
          [GeolocationPositionError.TIMEOUT]:
            'Geolocation request timed out (is VITE_GOOGLE_API_KEY set?)',
        };
        console.error(
          `Failed to get location: ${errorMessages[geoError.code] || 'Unknown error'} - ${geoError.message}`
        );
      } else {
        console.error('Failed to get location:', error);
      }
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
      appVersion: window.electron.process.env.npm_package_version ?? 'unknown',
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
