/**
 * Represents a schema for a document.
 *
 */
export type SimpleType = 'string' | 'number' | 'boolean';
export type ComplexType = 'map' | 'list';

export interface FieldAttributes {
  type: SimpleType;
  required?: boolean;
  default?: string | number;
  description?: string;
  min?: number;
  max?: number;
  order?: number;
}

export interface ReferenceAttributes {
  type: 'ref';
  required?: boolean;
  collection: string;
  description?: string;
}

export interface ComplexFieldAttributes {
  type: ComplexType;
  schema: Schema;
  required?: boolean;
  default?: any;
}

/**
 * Represents a zone/container within a layout.
 * All dimensions are percentages (0-100) for resolution independence.
 */
export interface LayoutZone {
  /** Unique identifier for the zone */
  id: string;
  /** Human-readable name for the zone */
  name: string;
  /** Position and size as percentages of the layout area */
  rect: {
    /** X position as percentage (0-100) */
    x: number;
    /** Y position as percentage (0-100) */
    y: number;
    /** Width as percentage (0-100) */
    width: number;
    /** Height as percentage (0-100) */
    height: number;
  };
  /** Z-order for overlapping zones (higher = on top) */
  zIndex: number;
  /** The playlist ID to display in this zone */
  playlistId?: number;
}

/**
 * Value structure for layout option type.
 * Defines a resolution-independent multi-zone layout.
 */
export interface LayoutOptionValue {
  /** Aspect ratio of the layout (e.g., "16:9", "9:16", "4:3") */
  aspectRatio: string;
  /** Array of zones/containers in the layout */
  zones: LayoutZone[];
}

/**
 * Schema attributes for a layout option field.
 * Used in widget options_schema to define a layout editor field.
 */
export interface LayoutFieldAttributes {
  type: 'layout';
  required?: boolean;
  description?: string;
  order?: number;
  /** Default layout configuration */
  default?: LayoutOptionValue;
  /** Available aspect ratio presets */
  aspectRatios?: string[];
}

/**
 * Value structure for layout reference with zone-playlist assignments.
 * Used when a widget references an existing layout and assigns playlists to zones.
 */
export interface LayoutRefValue {
  /** The ID of the referenced layout */
  layoutId: number;
  /** The aspect ratio of the layout */
  aspectRatio: string;
  /** The zones from the layout (stored for player rendering) */
  zones: {
    zones: Array<{
      id: string;
      name: string;
      rect: { x: number; y: number; width: number; height: number };
      zIndex: number;
    }>;
  };
  /** Map of zone ID to playlist assignment */
  zonePlaylistMap: Record<string, { playlistId: number; playlist?: any }>;
}

/**
 * Schema attributes for a layout reference field.
 * Allows selecting an existing layout and assigning playlists to its zones.
 */
export interface LayoutRefFieldAttributes {
  type: 'layout-ref';
  required?: boolean;
  description?: string;
  order?: number;
}

export type Schema = {
  [fieldName: string]:
    | SimpleType
    | FieldAttributes
    | ComplexFieldAttributes
    | ReferenceAttributes
    | LayoutFieldAttributes
    | LayoutRefFieldAttributes;
};
