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
    this.config = { ...DEFAULT_CONFIG, ...config };
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
    const wouldExceedCapacity =
      this.bufferedBytes + frame.size > this.config.maxBufferSize ||
      this.frameBuffer.length + 1 > this.config.maxFrames;

    // Check if adding this frame would exceed the drop threshold
    const byteUtilizationAfter =
      (this.bufferedBytes + frame.size) / this.config.maxBufferSize;
    const frameUtilizationAfter =
      (this.frameBuffer.length + 1) / this.config.maxFrames;
    const wouldExceedThreshold =
      byteUtilizationAfter >= this.config.dropThreshold ||
      frameUtilizationAfter >= this.config.dropThreshold;

    // Drop frames if needed
    if (wouldExceedThreshold || wouldExceedCapacity) {
      // Try dropping P-frames to make room
      const dropped = this.dropOldestPFrames();

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
      this.bufferedBytes -= frame.size;
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
    this.config = { ...this.config, ...config };
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
   * Drop the oldest P-frames until we're below the drop threshold or at least one is dropped
   * Returns the number of frames dropped
   */
  private dropOldestPFrames(): number {
    let droppedCount = 0;

    // Drop P-frames from oldest first until we're below threshold
    // or we've dropped at least one frame
    let i = 0;
    while (i < this.frameBuffer.length) {
      const needToDrop = this.shouldDropFrames() || droppedCount === 0;
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
    return this.getTimeSinceLastIFrame() >= this.config.minIFrameInterval;
  }

  /**
   * Get configuration
   */
  getConfig(): BackpressureConfig {
    return { ...this.config };
  }
}
