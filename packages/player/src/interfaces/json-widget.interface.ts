/**
 * JsonWidget
 *
 * Represents the JSON object return by the server for a widget.
 *
 */

import { Schema } from './schema.interface';
import { JsonWidgetTemplate } from './json-widget-template';

export interface JsonWidget {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  template: JsonWidgetTemplate;
  options_schema?: Schema;
  data_schema?: Schema;
  meta?: any;
  icon?: string;
  small_icon?: string;
  aspect_ratio?: string;
  update_interval_seconds?: number;
  // Custom fonts included with the widget
  fonts?: { url: string; name: string }[];
  // Original assets definition from widget.json
  assets?: {
    icons?: Record<
      string,
      { path: string; type: string; description?: string }
    >;
    images?: Record<
      string,
      { path: string; type: string; description?: string }
    >;
    fonts?: Record<
      string,
      { path: string; name: string; type: string; description?: string }
    >;
    styles?: Record<
      string,
      { path: string; type: string; description?: string }
    >;
  };
}
