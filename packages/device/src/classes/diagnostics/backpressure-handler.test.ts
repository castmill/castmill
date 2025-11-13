import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackpressureHandler, FrameInfo } from './backpressure-handler';

describe('BackpressureHandler', () => {
  let handler: BackpressureHandler;

  beforeEach(() => {
    handler = new BackpressureHandler({
      maxBufferSize: 1000,
      maxFrames: 10,
      dropThreshold: 0.8,
      minIFrameInterval: 2000,
    });
    vi.useFakeTimers();
  });

  describe('Frame Addition', () => {
    it('should add I-frame to buffer', () => {
      const iframe: FrameInfo = {
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      };

      const added = handler.addFrame(iframe);

      expect(added).toBe(true);
      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(1);
      expect(metrics.bufferedBytes).toBe(100);
    });

    it('should add P-frame to buffer', () => {
      const pframe: FrameInfo = {
        type: 'P',
        timestamp: Date.now(),
        size: 50,
      };

      const added = handler.addFrame(pframe);

      expect(added).toBe(true);
      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(1);
      expect(metrics.bufferedBytes).toBe(50);
    });

    it('should add multiple frames', () => {
      const iframe: FrameInfo = {
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      };
      const pframe1: FrameInfo = {
        type: 'P',
        timestamp: Date.now(),
        size: 50,
      };
      const pframe2: FrameInfo = {
        type: 'P',
        timestamp: Date.now(),
        size: 50,
      };

      handler.addFrame(iframe);
      handler.addFrame(pframe1);
      handler.addFrame(pframe2);

      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(3);
      expect(metrics.bufferedBytes).toBe(200);
    });

    it('should always accept I-frames even when buffer is full', () => {
      // Fill buffer with P-frames
      for (let i = 0; i < 10; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: Date.now(),
          size: 90,
        });
      }

      // Try to add I-frame
      const iframe: FrameInfo = {
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      };

      const added = handler.addFrame(iframe);
      expect(added).toBe(true);
    });
  });

  describe('Frame Retrieval', () => {
    it('should retrieve frames in FIFO order', () => {
      const iframe: FrameInfo = {
        type: 'I',
        timestamp: 1000,
        size: 100,
      };
      const pframe: FrameInfo = {
        type: 'P',
        timestamp: 2000,
        size: 50,
      };

      handler.addFrame(iframe);
      handler.addFrame(pframe);

      const first = handler.getNextFrame();
      expect(first?.timestamp).toBe(1000);

      const second = handler.getNextFrame();
      expect(second?.timestamp).toBe(2000);
    });

    it('should update metrics after frame retrieval', () => {
      handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      });

      handler.getNextFrame();

      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(0);
      expect(metrics.bufferedBytes).toBe(0);
    });

    it('should return undefined when buffer is empty', () => {
      const frame = handler.getNextFrame();
      expect(frame).toBeUndefined();
    });

    it('should peek at next frame without removing it', () => {
      const iframe: FrameInfo = {
        type: 'I',
        timestamp: 1000,
        size: 100,
      };

      handler.addFrame(iframe);

      const peeked = handler.peekNextFrame();
      expect(peeked?.timestamp).toBe(1000);

      // Buffer should still contain the frame
      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(1);
    });
  });

  describe('Backpressure Handling', () => {
    it('should drop oldest P-frames when threshold is reached', () => {
      // Add I-frame first
      handler.addFrame({
        type: 'I',
        timestamp: 1000,
        size: 100,
      });

      // Fill buffer to just below threshold with P-frames
      for (let i = 0; i < 6; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: 2000 + i,
          size: 100,
        });
      }

      const metricsBefore = handler.getMetrics();
      expect(metricsBefore.bufferedFrames).toBe(7);
      expect(metricsBefore.bufferedBytes).toBe(700); // 70% of 1000

      // Add more frames to exceed 80% threshold and trigger dropping
      handler.addFrame({
        type: 'P',
        timestamp: 3000,
        size: 150, // This pushes us to 850 bytes = 85%
      });

      const metricsAfter = handler.getMetrics();
      expect(metricsAfter.droppedFrames).toBeGreaterThan(0);
    });

    it('should track dropped frames count', () => {
      // Fill buffer completely
      for (let i = 0; i < 15; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: Date.now() + i,
          size: 100,
        });
      }

      const metrics = handler.getMetrics();
      expect(metrics.droppedFrames).toBeGreaterThan(0);
    });

    it('should record last drop timestamp', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Fill buffer to trigger drops
      for (let i = 0; i < 15; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: now + i,
          size: 100,
        });
      }

      const metrics = handler.getMetrics();
      expect(metrics.lastDropTimestamp).toBe(now);
    });

    it('should calculate buffer utilization correctly', () => {
      // Add 50% of max bytes
      handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 500,
      });

      const metrics = handler.getMetrics();
      expect(metrics.bufferUtilization).toBeCloseTo(0.5, 1);
    });

    it('should protect frames after last I-frame from dropping', () => {
      // Add old P-frames
      handler.addFrame({
        type: 'P',
        timestamp: 1000,
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: 2000,
        size: 100,
      });

      // Add I-frame
      handler.addFrame({
        type: 'I',
        timestamp: 3000,
        size: 100,
      });

      // Add new P-frames after I-frame
      handler.addFrame({
        type: 'P',
        timestamp: 4000,
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: 5000,
        size: 100,
      });

      // Fill to trigger drops
      for (let i = 0; i < 10; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: 6000 + i,
          size: 100,
        });
      }

      // The old P-frames before I-frame should be dropped first
      const nextFrame = handler.getNextFrame();
      // Should not get frames from timestamp 1000 or 2000
      expect(nextFrame?.timestamp).toBeGreaterThanOrEqual(3000);
    });

    it('should reject P-frame when no frames can be dropped', () => {
      // Fill buffer with only I-frames (can't be dropped)
      for (let i = 0; i < 10; i++) {
        handler.addFrame({
          type: 'I',
          timestamp: Date.now() + i,
          size: 100,
        });
      }

      // Try to add P-frame
      const added = handler.addFrame({
        type: 'P',
        timestamp: Date.now(),
        size: 100,
      });

      expect(added).toBe(false);
      const metrics = handler.getMetrics();
      expect(metrics.droppedFrames).toBe(1);
    });
  });

  describe('Buffer Management', () => {
    it('should report empty status correctly', () => {
      expect(handler.isEmpty()).toBe(true);

      handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      });

      expect(handler.isEmpty()).toBe(false);

      handler.getNextFrame();

      expect(handler.isEmpty()).toBe(true);
    });

    it('should clear buffer', () => {
      handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: Date.now(),
        size: 50,
      });

      handler.clear();

      expect(handler.isEmpty()).toBe(true);
      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(0);
      expect(metrics.bufferedBytes).toBe(0);
    });

    it('should reset all metrics', () => {
      // Add frames and trigger drops
      for (let i = 0; i < 15; i++) {
        handler.addFrame({
          type: 'P',
          timestamp: Date.now() + i,
          size: 100,
        });
      }

      handler.reset();

      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(0);
      expect(metrics.bufferedBytes).toBe(0);
      expect(metrics.droppedFrames).toBe(0);
      expect(metrics.lastDropTimestamp).toBe(0);
    });
  });

  describe('I-Frame Timing', () => {
    it('should track time since last I-frame', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      handler.addFrame({
        type: 'I',
        timestamp: now,
        size: 100,
      });

      vi.advanceTimersByTime(1000);

      expect(handler.getTimeSinceLastIFrame()).toBe(1000);
    });

    it('should return Infinity when no I-frame has been added', () => {
      expect(handler.getTimeSinceLastIFrame()).toBe(Infinity);
    });

    it('should indicate when I-frame is needed', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      expect(handler.needsIFrame()).toBe(true);

      handler.addFrame({
        type: 'I',
        timestamp: now,
        size: 100,
      });

      expect(handler.needsIFrame()).toBe(false);

      // Advance past minIFrameInterval
      vi.advanceTimersByTime(2500);

      expect(handler.needsIFrame()).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultHandler = new BackpressureHandler();
      const config = defaultHandler.getConfig();

      expect(config.maxBufferSize).toBe(10 * 1024 * 1024);
      expect(config.maxFrames).toBe(100);
      expect(config.dropThreshold).toBe(0.8);
      expect(config.minIFrameInterval).toBe(2000);
    });

    it('should accept custom configuration', () => {
      const customHandler = new BackpressureHandler({
        maxBufferSize: 5000,
        maxFrames: 50,
      });

      const config = customHandler.getConfig();
      expect(config.maxBufferSize).toBe(5000);
      expect(config.maxFrames).toBe(50);
    });

    it('should update configuration', () => {
      handler.updateConfig({
        maxBufferSize: 2000,
      });

      const config = handler.getConfig();
      expect(config.maxBufferSize).toBe(2000);
      // Other settings should remain unchanged
      expect(config.maxFrames).toBe(10);
    });

    it('should respect updated configuration for backpressure', () => {
      // Set low threshold
      handler.updateConfig({
        dropThreshold: 0.5,
      });

      // Add frames to just below 50% capacity
      handler.addFrame({
        type: 'P',
        timestamp: 1000,
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: 2000,
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: 3000,
        size: 100,
      });
      handler.addFrame({
        type: 'P',
        timestamp: 4000,
        size: 100,
      });

      // At 400 bytes (40% of 1000), no drops yet
      let metrics = handler.getMetrics();
      expect(metrics.droppedFrames).toBe(0);

      // Adding this frame brings us to 600 bytes (60%), exceeding 50% threshold
      handler.addFrame({
        type: 'P',
        timestamp: 5000,
        size: 200,
      });

      metrics = handler.getMetrics();
      // Should have triggered backpressure at 50%
      expect(metrics.droppedFrames).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-size frames', () => {
      handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 0,
      });

      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(1);
      expect(metrics.bufferedBytes).toBe(0);
    });

    it('should handle very large frames', () => {
      const added = handler.addFrame({
        type: 'I',
        timestamp: Date.now(),
        size: 2000, // Larger than maxBufferSize
      });

      expect(added).toBe(true); // I-frames are always accepted
    });

    it('should handle rapid frame additions', () => {
      const now = Date.now();

      for (let i = 0; i < 100; i++) {
        handler.addFrame({
          type: i % 10 === 0 ? 'I' : 'P',
          timestamp: now + i,
          size: 50,
        });
      }

      // Should not crash and should have dropped some frames
      const metrics = handler.getMetrics();
      expect(metrics.droppedFrames).toBeGreaterThan(0);
    });

    it('should handle alternating frame additions and retrievals', () => {
      handler.addFrame({
        type: 'I',
        timestamp: 1000,
        size: 100,
      });

      handler.getNextFrame();

      handler.addFrame({
        type: 'P',
        timestamp: 2000,
        size: 50,
      });

      const metrics = handler.getMetrics();
      expect(metrics.bufferedFrames).toBe(1);
      expect(metrics.bufferedBytes).toBe(50);
    });
  });
});
