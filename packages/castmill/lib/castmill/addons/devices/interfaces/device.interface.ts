import type { DeviceInfo } from '@castmill/device';

export interface Device {
  id: string;
  name: string;
  description: string;
  online: boolean;
  last_online: Date;
  location: string;
  city: string;
  country: string;
  last_ip: string;
  inserted_at: Date;
  updated_at: Date;
  autorecover_until?: string | null;
  info?: Partial<DeviceInfo> | null;
  timezone?: string;
  user_agent?: string;
  version?: string;
  log_level: 'info' | 'warning' | 'error' | 'debug' | 'critical' | 'trace';
}
