export interface DeviceEvent {
  id: string;
  timestamp: Date;
  msg: string;
  type_name: 'online' | 'offline' | 'error' | 'info' | 'warning';
  type: string;
  category?: string;
  code?: string;
  stack?: string;
  context?: Record<string, string | number>;
  occurrence_count?: number;
  first_occurred_at?: string;
  last_occurred_at?: string;
}
