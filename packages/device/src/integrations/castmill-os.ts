import type {
  DeviceInfo,
  Machine,
  OsUpdateStatus,
  OsUpdateTarget,
  SettingKey,
  TelemetryData,
  WifiNetwork,
  WifiStatus,
} from '../interfaces/machine';

/**
 * Native bridge that the Castmill OS kiosk shell exposes to the device app as
 * `window.castmillOS`. Each call is answered by the shell (settings,
 * credentials, app restart, cache) or by the castmill-agent OS service
 * (machine ID, device info, telemetry, time zone, reboot).
 *
 * The shell only answers the main frame of the Castmill origin it loaded.
 * Protocol: https://github.com/castmill/castmill-os/blob/main/docs/castmill-integration.md
 */
export interface CastmillOSBridge {
  /** Bridge protocol version. Newer versions stay backwards compatible. */
  readonly version: number;
  call(method: string, ...args: unknown[]): Promise<unknown>;
}

/** Lowest bridge version this machine works with. */
export const CASTMILL_OS_BRIDGE_VERSION = 1;

/**
 * Returns the Castmill OS bridge when the device app runs inside the Castmill
 * OS kiosk shell, otherwise undefined.
 */
export function getCastmillOSBridge(
  scope: { castmillOS?: unknown } = typeof window !== 'undefined'
    ? (window as { castmillOS?: unknown })
    : {}
): CastmillOSBridge | undefined {
  const bridge = scope.castmillOS as Partial<CastmillOSBridge> | undefined;
  if (
    bridge &&
    typeof bridge.call === 'function' &&
    typeof bridge.version === 'number' &&
    bridge.version >= CASTMILL_OS_BRIDGE_VERSION
  ) {
    return bridge as CastmillOSBridge;
  }
  return undefined;
}

/**
 * Machine for Castmill OS (https://github.com/castmill/castmill-os), the
 * immutable Linux distribution for Castmill players. Every output of a
 * Castmill OS device runs its own device app and registers as its own device.
 *
 * Not implemented on purpose: shutdown (signage players stay on), app updates
 * (the player is part of the OS image), firmware updates (OS updates are
 * managed by Castmill OS itself for now) and native orientation (the device
 * rotates content with CSS).
 */
export class CastmillOSMachine implements Machine {
  constructor(private readonly bridge: CastmillOSBridge) {}

  private call<T>(method: string, ...args: unknown[]): Promise<T> {
    return this.bridge.call(method, ...args) as Promise<T>;
  }

  getSetting(key: SettingKey): Promise<string | null> {
    return this.call<string | null>('getSetting', key);
  }

  async setSetting(key: SettingKey, value: string): Promise<void> {
    await this.call('setSetting', key, value);
  }

  /** Stable per device and output; the device hashes it before sending. */
  getMachineGUID(): Promise<string> {
    return this.call<string>('getMachineGUID');
  }

  async storeCredentials(credentials: string): Promise<void> {
    await this.call('storeCredentials', credentials);
  }

  getCredentials(): Promise<string | null> {
    return this.call<string | null>('getCredentials');
  }

  async removeCredentials(): Promise<void> {
    await this.call('removeCredentials');
  }

  /**
   * Castmill OS has no location source (Chromium's geolocation in Electron
   * needs a Google API key), so devices register without a location. The
   * device calls this unconditionally while registering.
   */
  async getLocation(): Promise<
    undefined | { latitude: number; longitude: number }
  > {
    return undefined;
  }

  getTimezone(): Promise<string> {
    return this.call<string>('getTimezone');
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const [info, hardware] = await Promise.all([
      this.call<Omit<DeviceInfo, 'userAgent'>>('getDeviceInfo'),
      this.getHardwareInfo(),
    ]);
    return { ...info, ...hardware, userAgent: navigator.userAgent };
  }

  /**
   * CPU, memory, GPU, graphics acceleration, hardware video decoding and
   * display mode. A separate bridge call, so that Castmill OS never sends
   * fields a Castmill server doesn't know; older Castmill OS versions don't
   * have it.
   */
  private async getHardwareInfo(): Promise<Partial<DeviceInfo>> {
    try {
      return pickHardwareInfo(await this.call<unknown>('getHardwareInfo'));
    } catch {
      return {};
    }
  }

  getTelemetry(): Promise<TelemetryData> {
    return this.call<TelemetryData>('getTelemetry');
  }

  async restart(): Promise<void> {
    await this.call('restart');
  }

  async reboot(): Promise<void> {
    await this.call('reboot');
  }

  async clearCache(): Promise<void> {
    await this.call('clearCache');
  }

  async setOsUpdate(target: OsUpdateTarget): Promise<void> {
    await this.call('setOsUpdate', target);
  }

  /** Undefined on Castmill OS versions without Wi-Fi in the menu (0.3 and older). */
  async getWifiStatus(): Promise<WifiStatus | undefined> {
    try {
      return pickWifiStatus(await this.call<unknown>('getWifiStatus'));
    } catch {
      return undefined;
    }
  }

  /** Castmill OS only joins while the device is offline. */
  async connectWifi(ssid: string, psk: string, hidden = false): Promise<void> {
    await this.call('connectWifi', ssid, psk, hidden);
  }

  /** Undefined on Castmill OS versions without OS update support (0.2 and older). */
  async getOsUpdateStatus(): Promise<OsUpdateStatus | undefined> {
    try {
      const status = await this.call<OsUpdateStatus>('getOsUpdateStatus');
      return status && typeof status.compatible === 'string'
        ? status
        : undefined;
    } catch {
      return undefined;
    }
  }
}

const MAX_HARDWARE_TEXT = 200;
const MAX_VIDEO_FORMATS = 16;

/** The hardware fields of DeviceInfo, with the right types and sizes only. */
export function pickHardwareInfo(value: unknown): Partial<DeviceInfo> {
  if (!value || typeof value !== 'object') return {};
  const h = value as Record<string, unknown>;
  const out: Partial<DeviceInfo> = {};
  for (const key of ['cpu', 'memory', 'gpu', 'display'] as const) {
    const v = h[key];
    if (typeof v === 'string' && v !== '') {
      out[key] = v.slice(0, MAX_HARDWARE_TEXT);
    }
  }
  if (
    h.graphicsAcceleration === 'hardware' ||
    h.graphicsAcceleration === 'software'
  ) {
    out.graphicsAcceleration = h.graphicsAcceleration;
  }
  if (Array.isArray(h.videoDecoding)) {
    out.videoDecoding = h.videoDecoding
      .filter((f): f is string => typeof f === 'string' && f.length <= 64)
      .slice(0, MAX_VIDEO_FORMATS);
  }
  return out;
}

const MAX_WIFI_NETWORKS = 30;

const pickWifiNetwork = (value: unknown): WifiNetwork | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const n = value as Record<string, unknown>;
  if (typeof n.ssid !== 'string' || n.ssid === '' || n.ssid.length > 32) {
    return undefined;
  }
  const signal = typeof n.signal === 'number' ? n.signal : 0;
  return {
    ssid: n.ssid,
    signal: Math.max(0, Math.min(100, Math.round(signal))),
    secure: n.secure === true,
    active: n.active === true,
  };
};

/** A WifiStatus with the right types only (the menu renders it). */
export function pickWifiStatus(value: unknown): WifiStatus | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const s = value as Record<string, unknown>;
  const networks = Array.isArray(s.networks)
    ? s.networks
        .map(pickWifiNetwork)
        .filter((n): n is WifiNetwork => !!n)
        .slice(0, MAX_WIFI_NETWORKS)
    : [];
  return {
    available: s.available === true,
    online: s.online === true,
    current: pickWifiNetwork(s.current),
    networks,
    error: typeof s.error === 'string' ? s.error.slice(0, 200) : undefined,
  };
}
