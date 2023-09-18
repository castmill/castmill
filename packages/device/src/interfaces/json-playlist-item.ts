import { JsonWidget } from "./json-widget";
import { JsonWidgetConfig } from "./json-widget-config";

export interface JsonPlaylistItem {
  id: number;
  duration: number;
  offset: number;
  inserted_at: string;
  updated_at: string;
  config: JsonWidgetConfig;
  widget: JsonWidget;
  slack: number;
  name: string;
}
