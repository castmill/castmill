import type { DeviceInfo, Orientation } from '@castmill/device';

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
  };
  online: boolean;
  last_online: Date;
  location: string;
  city: string;
  country: string;
  last_ip: string;
  inserted_at: Date;
  updated_at: Date;
  autorecover_until?: string | null;
  info?:
    | (Partial<DeviceInfo> & { capabilities?: Partial<DeviceCapabilities> })
    | null;
  timezone?: string;
  user_agent?: string;
  version?: string;
  log_level: 'info' | 'warning' | 'error' | 'debug' | 'critical' | 'trace';
}
