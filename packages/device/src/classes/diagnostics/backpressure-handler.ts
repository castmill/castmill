/**
 * BackpressureHandler
 *
 * Handles backpressure in video streaming by implementing frame dropping strategies.
 * When buffer capacity is reached, drops the oldest P-frames to maintain smooth playback.
 */

export interface FrameInfo {
  type: 'I' | 'P';
  timestamp: number;
  size: number;
  data?: any;
}

export interface BackpressureConfig {
  maxBufferSize: number; // Maximum buffer size in bytes
  maxFrames: number; // Maximum number of frames to buffer
  dropThreshold: number; // Percentage (0-1) at which to start dropping frames
  minIFrameInterval: number; // Minimum time between I-frames in ms
}

export interface BackpressureMetrics {
  bufferedFrames: number;
  bufferedBytes: number;
  droppedFrames: number;
  lastDropTimestamp: number;
  bufferUtilization: number; // Percentage (0-1)
}

const DEFAULT_CONFIG: BackpressureConfig = {
  maxBufferSize: 10 * 1024 * 1024, // 10MB
  maxFrames: 100,
  dropThreshold: 0.8, // Start dropping at 80% capacity
  minIFrameInterval: 2000, // 2 seconds
};

export class BackpressureHandler {
  private config: BackpressureConfig;
  private frameBuffer: FrameInfo[] = [];
  private bufferedBytes = 0;
  private droppedFrames = 0;
  private lastDropTimestamp = 0;
  private lastIFrameTimestamp = 0;

  constructor(config?: Partial<BackpressureConfig>) {
    this.config = BackpressureHandler.validateConfig({
      ...DEFAULT_CONFIG,
      ...config,
    });
  }

  /**
   * Validates the BackpressureConfig object.
   * Ensures dropThreshold is between 0 and 1 (inclusive).
   * Throws an error if invalid.
   */
  private static validateConfig(
    config: BackpressureConfig
  ): BackpressureConfig {
    if (
      typeof config.dropThreshold !== 'number' ||
      config.dropThreshold < 0 ||
      config.dropThreshold > 1
    ) {
      throw new Error(
        `Invalid dropThreshold: ${config.dropThreshold}. Must be a number between 0 and 1.`
      );
    }
    return config;
  }

  /**
   * Add a frame to the buffer
   * Returns true if frame was added, false if it was dropped
   */
  addFrame(frame: FrameInfo): boolean {
    // Always accept I-frames as they are required for decoding
    if (frame.type === 'I') {
      this.frameBuffer.push(frame);
      this.bufferedBytes += frame.size;
      this.lastIFrameTimestamp = frame.timestamp;
      return true;
    }

    // Check if adding this frame would exceed capacity
    let wouldExceedCapacity =
      this.bufferedBytes + frame.size > this.config.maxBufferSize ||
      this.frameBuffer.length + 1 > this.config.maxFrames;

    // Check if adding this frame would exceed the drop threshold
    let byteUtilizationAfter =
      (this.bufferedBytes + frame.size) / this.config.maxBufferSize;
    let frameUtilizationAfter =
      (this.frameBuffer.length + 1) / this.config.maxFrames;
    let wouldExceedThreshold =
      byteUtilizationAfter >= this.config.dropThreshold ||
      frameUtilizationAfter >= this.config.dropThreshold;

    // Drop frames if needed
    if (wouldExceedThreshold || wouldExceedCapacity) {
      // Try dropping P-frames to make room
      // Keep dropping until we're below threshold or no more P-frames to drop
      while (wouldExceedThreshold || wouldExceedCapacity) {
        const dropped = this.dropOldestPFrames();
        if (dropped === 0) {
          // No more P-frames to drop
          break;
        }
        
        // Recalculate after dropping
        wouldExceedCapacity =
          this.bufferedBytes + frame.size > this.config.maxBufferSize ||
          this.frameBuffer.length + 1 > this.config.maxFrames;
        
        const byteUtil = (this.bufferedBytes + frame.size) / this.config.maxBufferSize;
        const frameUtil = (this.frameBuffer.length + 1) / this.config.maxFrames;
        wouldExceedThreshold =
          byteUtil >= this.config.dropThreshold ||
          frameUtil >= this.config.dropThreshold;
      }

      // Check again if we can add the frame after dropping
      const canAddNow =
        this.bufferedBytes + frame.size <= this.config.maxBufferSize &&
        this.frameBuffer.length < this.config.maxFrames;

      if (!canAddNow) {
        // Still can't add, reject this frame
        this.droppedFrames++;
        this.lastDropTimestamp = Date.now();
        return false;
      }
    }

    // Add the frame
    this.frameBuffer.push(frame);
    this.bufferedBytes += frame.size;
    return true;
  }

  /**
   * Remove and return the next frame from the buffer
   */
  getNextFrame(): FrameInfo | undefined {
    const frame = this.frameBuffer.shift();
    if (frame) {
      this.bufferedBytes = Math.max(0, this.bufferedBytes - frame.size);
    }
    return frame;
  }

  /**
   * Peek at the next frame without removing it
   */
  peekNextFrame(): FrameInfo | undefined {
    return this.frameBuffer[0];
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.frameBuffer.length === 0;
  }

  /**
   * Get current buffer metrics
   */
  getMetrics(): BackpressureMetrics {
    const bufferUtilization = Math.max(
      this.bufferedBytes / this.config.maxBufferSize,
      this.frameBuffer.length / this.config.maxFrames
    );

    return {
      bufferedFrames: this.frameBuffer.length,
      bufferedBytes: this.bufferedBytes,
      droppedFrames: this.droppedFrames,
      lastDropTimestamp: this.lastDropTimestamp,
      bufferUtilization,
    };
  }

  /**
   * Clear all frames from the buffer
   */
  clear(): void {
    this.frameBuffer = [];
    this.bufferedBytes = 0;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.clear();
    this.droppedFrames = 0;
    this.lastDropTimestamp = 0;
    this.lastIFrameTimestamp = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackpressureConfig>): void {
    this.config = BackpressureHandler.validateConfig({
      ...this.config,
      ...config,
    });
  }

  /**
   * Check if we should start dropping frames
   */
  private shouldDropFrames(): boolean {
    const byteUtilization = this.bufferedBytes / this.config.maxBufferSize;
    const frameUtilization = this.frameBuffer.length / this.config.maxFrames;

    return (
      byteUtilization >= this.config.dropThreshold ||
      frameUtilization >= this.config.dropThreshold
    );
  }

  /**
   * Drop the oldest P-frame to make room, then continue dropping until below threshold
   * Returns the number of frames dropped
   */
  private dropOldestPFrames(): number {
    let droppedCount = 0;

    // Drop P-frames from oldest first
    // Drop at least one P-frame (if available) to make room, then continue until below threshold
    let i = 0;
    while (i < this.frameBuffer.length) {
      // Check if we need to keep dropping
      // If we haven't dropped any yet, try to drop at least one
      // Otherwise, only continue if we're still above threshold
      const needToDrop = droppedCount === 0 || this.shouldDropFrames();
      if (!needToDrop) {
        break;
      }

      if (this.frameBuffer[i]?.type === 'P') {
        const frame = this.frameBuffer.splice(i, 1)[0];
        this.bufferedBytes -= frame.size;
        droppedCount++;
        this.droppedFrames++;
        this.lastDropTimestamp = Date.now();
        // Don't increment i since we removed an element
      } else {
        // It's an I-frame, skip it
        i++;
      }
    }

    return droppedCount;
  }

  /**
   * Get the time since last I-frame
   */
  getTimeSinceLastIFrame(): number {
    if (this.lastIFrameTimestamp === 0) {
      return Infinity;
    }
    return Date.now() - this.lastIFrameTimestamp;
  }

  /**
   * Check if an I-frame is needed based on timing
   */
  needsIFrame(): boolean {
    // Explicitly handle the "no I-frame yet" case for clarity and consistency
    if (this.lastIFrameTimestamp === 0) {
      return true;
    }
    return this.getTimeSinceLastIFrame() >= this.config.minIFrameInterval;
  }

  /**
   * Get configuration
   */
  getConfig(): BackpressureConfig {
    return { ...this.config };
  }
}
