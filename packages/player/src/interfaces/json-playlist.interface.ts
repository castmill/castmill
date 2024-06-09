// Note: Currently this is a duplicate of the JsonPlaylist interface in packages/device/src/interfaces/json-playlist.ts
// Temporary until we can figure out how to refactor the interface from the device package.
import { JsonPlaylistItem } from './json-playlist-item.interface';
export interface JsonPlaylist {
  id: number;
  name: string;
  status: 'draft' | 'live' | 'archived';
  items: JsonPlaylistItem[];
  settings?: any;
  inserted_at?: string;
  updated_at?: string;
}
