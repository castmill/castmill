export interface Device {
  id: string;
  name: string;
  online: boolean;
  last_online: Date;
  location: string;
  city: string;
  country: string;
  ip: string;
}
