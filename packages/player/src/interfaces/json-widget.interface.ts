/**
 * JsonWidget
 *
 * Represents the JSON object return by the server for a widget.
 *
 */
export interface JsonWidgetTemplate {
  type: string
  name: string
  opts: any
}

export interface JsonWidget {
  id: number
  name: string
  template: JsonWidgetTemplate
  options_schema?: any
  data_schema?: any
  meta?: any
  icon?: string
  small_icon?: string
  update_granularity?: number
}
