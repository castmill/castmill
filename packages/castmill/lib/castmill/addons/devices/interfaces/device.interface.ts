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
  log_level: "info" | "warning" | "error" | "debug" | "critical" | "trace";
}
