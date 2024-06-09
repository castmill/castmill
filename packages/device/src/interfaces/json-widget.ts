import { Schema } from './schema';

/**
 * JsonWidget
 *
 * Represents the JSON object return by the server for a widget.
 *
 */
export interface JsonWidget {
  id: number;
  name: string;
  description: string;
  template: {
    type: string;
    name: string;
    opts: { [key: string]: string | number | boolean };
  };
  options_schema?: Schema;
  data_schema?: Schema;
  meta?: any;
  icon?: string;
  small_icon?: string;
  update_interval_seconds?: number;
}
