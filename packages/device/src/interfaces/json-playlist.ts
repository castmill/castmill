import { JsonPlaylistItem } from './json-playlist-item'

export interface JsonPlaylist {
  id: number
  name: string
  status: 'draft' | 'live' | 'archived'
  items: JsonPlaylistItem[]
  settings: null
  inserted_at?: string
  updated_at?: string
}
