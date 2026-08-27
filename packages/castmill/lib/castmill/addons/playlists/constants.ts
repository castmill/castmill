/**
 * Shared constants for the Playlists addon
 */

export interface AspectRatioPreset {
  value: string;
  label: string;
  width?: number;
  height?: number;
}

/**
 * Common aspect ratio presets for digital signage displays
 */
export const ASPECT_RATIO_OPTIONS: AspectRatioPreset[] = [
  {
    value: '16:9',
    label: 'playlists.aspectRatioPresets.16:9',
    width: 16,
    height: 9,
  },
  {
    value: '9:16',
    label: 'playlists.aspectRatioPresets.9:16',
    width: 9,
    height: 16,
  },
  {
    value: '4:3',
    label: 'playlists.aspectRatioPresets.4:3',
    width: 4,
    height: 3,
  },
  {
    value: '3:4',
    label: 'playlists.aspectRatioPresets.3:4',
    width: 3,
    height: 4,
  },
  {
    value: '21:9',
    label: 'playlists.aspectRatioPresets.21:9',
    width: 21,
    height: 9,
  },
  {
    value: '16:3',
    label: 'playlists.aspectRatioPresets.16:3',
    width: 16,
    height: 3,
  },
  {
    value: '3:16',
    label: 'playlists.aspectRatioPresets.3:16',
    width: 3,
    height: 16,
  },
  {
    value: '1:1',
    label: 'playlists.aspectRatioPresets.1:1',
    width: 1,
    height: 1,
  },
  {
    value: 'custom',
    label: 'playlists.aspectRatioPresets.custom',
    width: 0,
    height: 0,
  },
];

/**
 * Maximum allowed aspect ratio value (width or height)
 */
export const MAX_ASPECT_RATIO_VALUE = 100;

/**
 * Maximum allowed aspect ratio (width/height)
 */
export const MAX_ASPECT_RATIO = 10;

/**
 * Minimum allowed aspect ratio (width/height)
 */
export const MIN_ASPECT_RATIO = 0.1;
