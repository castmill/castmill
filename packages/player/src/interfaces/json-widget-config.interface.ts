export interface OptionsDict {
  [key: string]: string | number | boolean | object;
}
export interface JsonWidgetConfig {
  id?: string;
  widget_id: number;
  options: OptionsDict;
  data: OptionsDict;
}
