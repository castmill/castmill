import { JSX } from 'solid-js'

import { JsonWidget } from './json-widget.interface'
import { JsonTransition } from '../transitions'
import { JsonWidgetConfig } from './json-widget-config.interface'
export interface JsonLayer {
  name: string
  duration?: number
  slack: number
  config: JsonWidgetConfig
  widget: JsonWidget
  transition?: JsonTransition
  style?: JSX.CSSProperties
}
