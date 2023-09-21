export interface JsonWidgetConfig {
  id: string;
  widget_id: number;
  options: { [key: string]: string | number | boolean | object };
  data: { [key: string]: string | number | boolean | object };
}
