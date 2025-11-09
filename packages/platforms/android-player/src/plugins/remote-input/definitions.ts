/**
 * TypeScript definitions for RemoteInput Capacitor plugin
 */

export interface RemoteInputPlugin {
  /**
   * Sets the remote control window dimensions for coordinate mapping.
   * @param options - Remote window dimensions
   */
  setRemoteDimensions(options: { width: number; height: number }): Promise<{ width: number; height: number }>;

  /**
   * Gets the current device screen dimensions.
   */
  getDeviceDimensions(): Promise<{ width: number; height: number }>;

  /**
   * Gets the current display rotation.
   * @returns rotation - 0: Portrait, 1: Landscape (90°), 2: Reverse portrait (180°), 3: Reverse landscape (270°)
   */
  getDisplayRotation(): Promise<{ rotation: number }>;

  /**
   * Executes a tap gesture at the specified coordinates.
   * @param options - Tap coordinates in remote window
   */
  executeTap(options: { x: number; y: number }): Promise<void>;

  /**
   * Executes a long press gesture at the specified coordinates.
   * @param options - Long press coordinates in remote window
   */
  executeLongPress(options: { x: number; y: number }): Promise<void>;

  /**
   * Executes a swipe gesture between two points.
   * @param options - Swipe parameters
   */
  executeSwipe(options: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    duration?: number; // Optional duration in milliseconds (default: 300)
  }): Promise<void>;

  /**
   * Executes a multi-step gesture following a path of points.
   * @param options - Multi-step gesture parameters
   */
  executeMultiStepGesture(options: {
    points: Array<{ x: number; y: number }>; // Minimum 2 points required
    duration?: number; // Optional total duration in milliseconds (default: 500)
  }): Promise<void>;

  /**
   * Checks if the accessibility service is running.
   */
  isServiceRunning(): Promise<{ isRunning: boolean }>;

  /**
   * Gets information about coordinate mapping configuration.
   */
  getMappingInfo(): Promise<{
    deviceWidth: number;
    deviceHeight: number;
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  }>;
}

/**
 * Display rotation constants
 */
export enum DisplayRotation {
  PORTRAIT = 0,
  LANDSCAPE_90 = 1,
  REVERSE_PORTRAIT_180 = 2,
  REVERSE_LANDSCAPE_270 = 3,
}

/**
 * Point type for multi-step gestures
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Mapping information returned by getMappingInfo
 */
export interface MappingInfo {
  deviceWidth: number;
  deviceHeight: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Remote dimensions configuration
 */
export interface RemoteDimensions {
  width: number;
  height: number;
}

/**
 * Device dimensions
 */
export interface DeviceDimensions {
  width: number;
  height: number;
}

/**
 * Tap gesture options
 */
export interface TapOptions {
  x: number;
  y: number;
}

/**
 * Long press gesture options
 */
export interface LongPressOptions {
  x: number;
  y: number;
}

/**
 * Swipe gesture options
 */
export interface SwipeOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  duration?: number;
}

/**
 * Multi-step gesture options
 */
export interface MultiStepGestureOptions {
  points: Point[];
  duration?: number;
}

/**
 * Service status
 */
export interface ServiceStatus {
  isRunning: boolean;
}
