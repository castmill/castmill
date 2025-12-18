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
}
