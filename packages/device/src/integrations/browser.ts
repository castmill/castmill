import {
  Machine,
  type DeviceInfo,
  type SettingKey,
} from '../interfaces/machine';

/**
 * Parse browser name and version from user agent string
 */
function parseBrowserInfo(userAgent: string): {
  name: string;
  version: string;
} {
  // Check for common browsers
  const browsers = [
    { name: 'Chrome', regex: /Chrome\/(\d+\.\d+\.\d+\.\d+)/ },
    { name: 'Firefox', regex: /Firefox\/(\d+\.\d+)/ },
    { name: 'Safari', regex: /Version\/(\d+\.\d+).*Safari/ },
    { name: 'Edge', regex: /Edg\/(\d+\.\d+\.\d+\.\d+)/ },
    { name: 'Opera', regex: /OPR\/(\d+\.\d+\.\d+\.\d+)/ },
  ];

  for (const browser of browsers) {
    const match = userAgent.match(browser.regex);
    if (match) {
      return { name: browser.name, version: match[1] };
    }
  }

  return { name: 'Browser', version: 'Unknown' };
}

/**
 * Parse OS information from user agent string
 */
function parseOSInfo(userAgent: string): string {
  if (userAgent.includes('Windows NT 10.0')) return 'Windows 10';
  if (userAgent.includes('Windows NT 11.0')) return 'Windows 11';
  if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (userAgent.includes('Windows NT 6.2')) return 'Windows 8';
  if (userAgent.includes('Windows NT 6.1')) return 'Windows 7';
  if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
    if (match) {
      return `macOS ${match[1].replace(/_/g, '.')}`;
    }
    return 'macOS';
  }
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android (\d+(\.\d+)?)/);
    if (match) {
      return `Android ${match[1]}`;
    }
    return 'Android';
  }
  if (userAgent.includes('iOS') || userAgent.includes('iPhone')) {
    const match = userAgent.match(/OS (\d+_\d+)/);
    if (match) {
      return `iOS ${match[1].replace(/_/g, '.')}`;
    }
    return 'iOS';
  }

  return 'Unknown OS';
}

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
    const userAgent = navigator.userAgent;
    const browser = parseBrowserInfo(userAgent);
    const os = parseOSInfo(userAgent);

    return {
      appType: browser.name,
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
      os: os,
      hardware: navigator.platform || 'Unknown',
      userAgent: userAgent,
    };
  }

  async restart(): Promise<void> {
    console.log('Refreshing the page');
    location.reload();
  }
}
