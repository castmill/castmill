import { JsonWidget } from './json-widget.interface';
import { JsonWidgetConfig } from './json-widget-config.interface';

export interface JsonPlaylistItem {
  id: number;
  duration: number;
  offset: number;
  widget: JsonWidget;
  slack: number;
  name: string;

  config: JsonWidgetConfig;
  inserted_at?: string;
  updated_at?: string;

  // Error message if integration data fetch failed
  integration_error?: string;
}
