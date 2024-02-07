import { JSX } from 'solid-js'

import { JsonPlaylist } from './'
export interface JsonLayout {
  name: string
  args: {
    duration: number
  }
  items: {
    playlist: JsonPlaylist
    style: JSX.CSSProperties
  }[]
}
