/**
 * Layout Editor Utility Functions
 *
 * Pure functions for aspect ratio calculations and canvas sizing.
 * These are extracted to be testable without browser dependencies.
 */

/**
 * Parses an aspect ratio string (e.g., "16:9") into width and height numbers.
 * Returns default 16:9 for invalid inputs.
 *
 * @param ratio - Aspect ratio string in "width:height" format
 * @returns Object with width and height numbers
 */
export const parseAspectRatio = (
  ratio: string
): { width: number; height: number } => {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return { width: 16, height: 9 }; // Default aspect ratio
  }
  return { width: w, height: h };
};

/**
 * Calculates canvas dimensions to fit within a container while maintaining aspect ratio.
 *
 * @param containerWidth - Available container width in pixels
 * @param containerHeight - Available container height in pixels
 * @param aspectRatio - Desired aspect ratio string (e.g., "16:9")
 * @returns Object with width and height in pixels
 */
export const calculateCanvasSize = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio: string
): { width: number; height: number } => {
  const { width: arW, height: arH } = parseAspectRatio(aspectRatio);
  const aspectValue = arW / arH;

  // Fit within container
  let canvasWidth = containerWidth;
  let canvasHeight = containerWidth / aspectValue;

  if (canvasHeight > containerHeight) {
    canvasHeight = containerHeight;
    canvasWidth = containerHeight * aspectValue;
  }

  return { width: Math.floor(canvasWidth), height: Math.floor(canvasHeight) };
};

/**
 * Calculate the height for a zone given its width while maintaining aspect ratio.
 * This accounts for the layout's aspect ratio when computing percentages.
 *
 * The math: In a layout with aspect ratio (layoutW:layoutH), a zone occupying
 * width% of width and height% of height has an actual aspect ratio of:
 *   (width% * layoutW) / (height% * layoutH) = zoneRatio
 *
 * Solving for height%:
 *   height% = (width% * layoutW) / (zoneRatio * layoutH)
 *   height% = width% * (layoutW/layoutH) / zoneRatio
 *   height% = width% * layoutRatio / zoneRatio
 *
 * @param width - Zone width as a percentage (0-100)
 * @param zoneAspectRatio - Desired zone aspect ratio (e.g., '16:9')
 * @param layoutAspectRatio - Layout's overall aspect ratio (e.g., '16:9')
 * @returns Height as a percentage (0-100)
 *
 * @example
 * // A 16:9 zone taking 50% width in a 16:9 layout needs 50% height
 * calculateHeightForAspectRatio(50, '16:9', '16:9') // => 50
 *
 * @example
 * // A 1:1 (square) zone taking 50% width in a 16:9 layout needs ~88.9% height
 * calculateHeightForAspectRatio(50, '1:1', '16:9') // => 88.89
 */
export const calculateHeightForAspectRatio = (
  width: number,
  zoneAspectRatio: string,
  layoutAspectRatio: string
): number => {
  const layoutAR = parseAspectRatio(layoutAspectRatio);
  const layoutRatio = layoutAR.width / layoutAR.height;
  const zoneAR = parseAspectRatio(zoneAspectRatio);
  const zoneRatio = zoneAR.width / zoneAR.height;
  return (width * layoutRatio) / zoneRatio;
};

/**
 * Calculate the width for a zone given its height while maintaining aspect ratio.
 * This accounts for the layout's aspect ratio when computing percentages.
 *
 * The math (inverse of calculateHeightForAspectRatio):
 *   width% = height% * zoneRatio / layoutRatio
 *
 * @param height - Zone height as a percentage (0-100)
 * @param zoneAspectRatio - Desired zone aspect ratio (e.g., '16:9')
 * @param layoutAspectRatio - Layout's overall aspect ratio (e.g., '16:9')
 * @returns Width as a percentage (0-100)
 *
 * @example
 * // A 16:9 zone taking 50% height in a 16:9 layout needs 50% width
 * calculateWidthForAspectRatio(50, '16:9', '16:9') // => 50
 *
 * @example
 * // A 1:1 (square) zone taking 50% height in a 16:9 layout needs ~28.1% width
 * calculateWidthForAspectRatio(50, '1:1', '16:9') // => 28.12
 */
export const calculateWidthForAspectRatio = (
  height: number,
  zoneAspectRatio: string,
  layoutAspectRatio: string
): number => {
  const layoutAR = parseAspectRatio(layoutAspectRatio);
  const layoutRatio = layoutAR.width / layoutAR.height;
  const zoneAR = parseAspectRatio(zoneAspectRatio);
  const zoneRatio = zoneAR.width / zoneAR.height;
  return (height * zoneRatio) / layoutRatio;
};

/**
 * Available aspect ratios for zones.
 * Includes common video/display formats.
 */
export const ZONE_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'];

/**
 * Default aspect ratios for layouts.
 */
export const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', '21:9'];
