export interface Channel {
  id: number;
  name: string;
  timezone: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  default_playlist_id: number | null;
}
