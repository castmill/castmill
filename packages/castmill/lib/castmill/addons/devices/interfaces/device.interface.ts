import type { DeviceInfo, Orientation, OsUpdateStatus } from '@castmill/device';

type DeviceCapabilities = NonNullable<DeviceInfo['capabilities']>;

export interface Device {
  id: string;
  name: string;
  description: string;
  orientation?: Orientation;
  orientation_status?: {
    orientation: Orientation;
    status: 'applied' | 'error';
    mode: 'native' | 'css' | 'unknown';
  } | null;
  online: boolean;
  last_online: Date;
  location: string;
  city: string;
  country: string;
  last_ip: string;
  inserted_at: Date;
  updated_at: Date;
  autorecover_until?: string | null;
  /** Castmill OS: this device's override of the organization's OS update policy. */
  os_update?: OsUpdateOverride | null;
  /** Castmill OS: the last OS update status the device reported. */
  os_status?: (OsUpdateStatus & { received_at?: string }) | null;
  info?:
    | (Partial<DeviceInfo> & { capabilities?: Partial<DeviceCapabilities> })
    | null;
  timezone?: string;
  user_agent?: string;
  version?: string;
  log_level: 'info' | 'warning' | 'error' | 'debug' | 'critical' | 'trace';
}

/** A device's choice of Castmill OS version. */
export interface OsUpdateOverride {
  mode: 'follow' | 'version';
  version?: string | null;
  /** Activate right away instead of in the maintenance window. */
  now?: boolean;
}

/** An organization's Castmill OS update policy. */
export interface OsUpdatePolicy {
  mode: 'manual' | 'latest' | 'version';
  version?: string | null;
  prereleases: boolean;
}

/** A Castmill OS release imported from GitHub. */
export interface OsRelease {
  version: string;
  prerelease: boolean;
  security: boolean;
  published_at: string;
  notes_url?: string | null;
  artifacts: Record<string, { url: string; sha256: string; size: number }>;
}
