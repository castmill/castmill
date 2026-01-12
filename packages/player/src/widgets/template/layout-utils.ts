/**
 * Utility functions for layout zone handling.
 * Separated from layout.tsx to allow testing without JSX dependencies.
 */

import type { LayoutZone } from '../../interfaces';

/**
 * CSS style properties interface - simplified version for utility functions.
 * Matches the subset needed for layout positioning.
 */
export interface LayoutStyle {
  position: 'absolute';
  width: string;
  height: string;
  top: string;
  left: string;
  'z-index': number;
}

/**
 * Rect defines the positioning of a container within the layout.
 * Values are typically percentages (e.g., "33.33%", "100%").
 */
export interface LayoutRect {
  width: string;
  height: string;
  top: string;
  left: string;
}

/**
 * CSS style properties interface for rect-to-style conversion.
 */
export interface RectStyle {
  position: 'absolute';
  width: string;
  height: string;
  top: string;
  left: string;
}

/**
 * Converts a rect object (with string percentages) to CSS style properties for absolute positioning.
 */
export function rectToStyle(rect: LayoutRect): RectStyle {
  return {
    position: 'absolute',
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
  };
}

/**
 * Converts a LayoutZone (from the visual editor) to CSS style properties.
 * Zone rect values are numeric percentages (0-100), converted to CSS percentage strings.
 * Also handles z-index for overlapping zones.
 */
export function zoneToStyle(zone: LayoutZone): LayoutStyle {
  return {
    position: 'absolute',
    width: `${zone.rect.width}%`,
    height: `${zone.rect.height}%`,
    top: `${zone.rect.y}%`,
    left: `${zone.rect.x}%`,
    'z-index': zone.zIndex,
  };
}
