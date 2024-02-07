import { JsonWidget } from './json-widget.interface'
import { JsonWidgetConfig } from './json-widget-config.interface'

export interface JsonPlaylistItem {
  id: number
  duration: number
  offset: number
  inserted_at: string
  updated_at: string
  config: JsonWidgetConfig
  widget: JsonWidget
  slack: number
  name: string
}
