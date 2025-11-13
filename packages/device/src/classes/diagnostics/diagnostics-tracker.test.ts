import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticsTracker } from './diagnostics-tracker';

describe('DiagnosticsTracker', () => {
  let tracker: DiagnosticsTracker;
  const deviceId = 'test-device-123';

  beforeEach(() => {
    tracker = new DiagnosticsTracker(deviceId);
    vi.useFakeTimers();
  });

  describe('Heartbeat Tracking', () => {
    it('should record heartbeat sent', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      tracker.recordHeartbeatSent();

      const metrics = tracker.getHeartbeatMetrics();
      expect(metrics.heartbeatCount).toBe(1);
      expect(metrics.lastHeartbeat).toBe(now);
    });

    it('should record multiple heartbeats', () => {
      tracker.recordHeartbeatSent();
      tracker.recordHeartbeatSent();
      tracker.recordHeartbeatSent();

      const metrics = tracker.getHeartbeatMetrics();
      expect(metrics.heartbeatCount).toBe(3);
    });

    it('should record heartbeat response with latency', () => {
      tracker.recordHeartbeatResponse(50);
      tracker.recordHeartbeatResponse(60);
      tracker.recordHeartbeatResponse(40);

      const metrics = tracker.getHeartbeatMetrics();
      expect(metrics.averageLatency).toBe(50);
    });

    it('should keep only last 100 latency measurements', () => {
      for (let i = 0; i < 150; i++) {
        tracker.recordHeartbeatResponse(i);
      }

      const metrics = tracker.getHeartbeatMetrics();
      // Should average last 100 values (50-149)
      const expectedAvg = (50 + 149) / 2;
      expect(metrics.averageLatency).toBeCloseTo(expectedAvg, 1);
    });

    it('should record missed heartbeats', () => {
      tracker.recordMissedHeartbeat();
      tracker.recordMissedHeartbeat();

      const metrics = tracker.getHeartbeatMetrics();
      expect(metrics.missedHeartbeats).toBe(2);
    });
  });

  describe('Connection Tracking', () => {
    it('should start in disconnected state', () => {
      const metrics = tracker.getConnectionMetrics();
      expect(metrics.connectionState).toBe('disconnected');
      expect(metrics.reconnectCount).toBe(0);
    });

    it('should track connection state changes', () => {
      tracker.setConnectionState('connected');
      let metrics = tracker.getConnectionMetrics();
      expect(metrics.connectionState).toBe('connected');

      tracker.setConnectionState('disconnected');
      metrics = tracker.getConnectionMetrics();
      expect(metrics.connectionState).toBe('disconnected');
    });

    it('should track reconnection attempts', () => {
      tracker.setConnectionState('reconnecting');
      tracker.setConnectionState('connected');
      tracker.setConnectionState('reconnecting');

      const metrics = tracker.getConnectionMetrics();
      expect(metrics.reconnectCount).toBe(2);
    });

    it('should calculate connection uptime', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      tracker.setConnectionState('connected');

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      const metrics = tracker.getConnectionMetrics();
      expect(metrics.connectionUptime).toBe(5000);
    });

    it('should track total downtime', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // Connect, then disconnect
      tracker.setConnectionState('connected');
      vi.advanceTimersByTime(1000);
      tracker.setConnectionState('disconnected');

      // Wait 5 seconds while disconnected
      vi.advanceTimersByTime(5000);

      const metrics = tracker.getConnectionMetrics();
      expect(metrics.totalDowntime).toBe(5000);
    });

    it('should track last reconnect attempt time', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      tracker.setConnectionState('reconnecting', now);

      const metrics = tracker.getConnectionMetrics();
      expect(metrics.lastReconnectAttempt).toBe(now);
    });
  });

  describe('Frame Tracking', () => {
    it('should record I-frames and P-frames', () => {
      tracker.recordFrame('I', 1000);
      tracker.recordFrame('P', 500);
      tracker.recordFrame('P', 500);

      const metrics = tracker.getFrameMetrics();
      expect(metrics.totalFrames).toBe(3);
      expect(metrics.iFrames).toBe(1);
      expect(metrics.pFrames).toBe(2);
    });

    it('should calculate FPS from frame timing', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // Record frames at 60fps (16.67ms apart)
      for (let i = 0; i < 10; i++) {
        tracker.recordFrame('P', 1000);
        vi.advanceTimersByTime(16.67);
      }

      const metrics = tracker.getFrameMetrics();
      // Should be close to 60 fps
      expect(metrics.fps).toBeGreaterThan(55);
      expect(metrics.fps).toBeLessThan(65);
    });

    it('should calculate average bitrate', () => {
      tracker.recordFrame('P', 1000);
      tracker.recordFrame('P', 2000);
      tracker.recordFrame('P', 1500);

      const metrics = tracker.getFrameMetrics();
      expect(metrics.averageBitrate).toBe(1500);
    });

    it('should keep only last 100 bitrate samples', () => {
      for (let i = 0; i < 150; i++) {
        tracker.recordFrame('P', i);
      }

      const metrics = tracker.getFrameMetrics();
      // Should average last 100 values (50-149)
      const expectedAvg = (50 + 149) / 2;
      expect(metrics.averageBitrate).toBeCloseTo(expectedAvg, 1);
    });

    it('should record frame drops', () => {
      tracker.recordFrameDrop();
      tracker.recordFrameDrop();
      tracker.recordFrameDrop();

      const metrics = tracker.getFrameMetrics();
      expect(metrics.frameDrops).toBe(3);
    });

    it('should keep only last 60 frame times for FPS calculation', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // Record 100 frames
      for (let i = 0; i < 100; i++) {
        tracker.recordFrame('P', 1000);
        vi.advanceTimersByTime(16.67);
      }

      const metrics = tracker.getFrameMetrics();
      expect(metrics.totalFrames).toBe(100);
      // FPS should be calculated from last 60 frames only
      expect(metrics.fps).toBeGreaterThan(0);
    });
  });

  describe('Jitter Buffer Tracking', () => {
    it('should update jitter buffer size', () => {
      tracker.updateJitterBuffer(100, 5);

      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.bufferSize).toBe(100);
    });

    it('should track buffer underflows', () => {
      tracker.updateJitterBuffer(50, 2, true);
      tracker.updateJitterBuffer(40, 3, true);

      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.bufferUnderflows).toBe(2);
    });

    it('should track buffer overflows', () => {
      tracker.updateJitterBuffer(200, 10, false, true);
      tracker.updateJitterBuffer(210, 12, false, true);
      tracker.updateJitterBuffer(205, 11, false, true);

      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.bufferOverflows).toBe(3);
    });

    it('should calculate average jitter', () => {
      tracker.updateJitterBuffer(100, 5);
      tracker.updateJitterBuffer(100, 10);
      tracker.updateJitterBuffer(100, 15);

      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.averageJitter).toBe(10);
    });

    it('should track maximum jitter', () => {
      tracker.updateJitterBuffer(100, 5);
      tracker.updateJitterBuffer(100, 20);
      tracker.updateJitterBuffer(100, 10);

      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.maxJitter).toBe(20);
    });

    it('should keep only last 100 jitter values', () => {
      for (let i = 0; i < 150; i++) {
        tracker.updateJitterBuffer(100, i);
      }

      const metrics = tracker.getJitterBufferMetrics();
      // Should average last 100 values (50-149)
      const expectedAvg = (50 + 149) / 2;
      expect(metrics.averageJitter).toBeCloseTo(expectedAvg, 1);
    });
  });

  describe('Network Metrics Tracking', () => {
    it('should update bytes received', () => {
      tracker.updateNetworkMetrics({ bytesReceived: 1000 });
      tracker.updateNetworkMetrics({ bytesReceived: 2000 });

      const metrics = tracker.getNetworkMetrics();
      expect(metrics.bytesReceived).toBe(2000);
    });

    it('should update bytes sent', () => {
      tracker.updateNetworkMetrics({ bytesSent: 500 });
      tracker.updateNetworkMetrics({ bytesSent: 800 });

      const metrics = tracker.getNetworkMetrics();
      expect(metrics.bytesSent).toBe(800);
    });

    it('should track packets lost', () => {
      tracker.updateNetworkMetrics({ packetsLost: 5 });

      const metrics = tracker.getNetworkMetrics();
      expect(metrics.packetsLost).toBe(5);
    });

    it('should track round trip time', () => {
      tracker.updateNetworkMetrics({ roundTripTime: 50 });

      const metrics = tracker.getNetworkMetrics();
      expect(metrics.roundTripTime).toBe(50);
    });

    it('should handle partial metric updates', () => {
      tracker.updateNetworkMetrics({ bytesReceived: 1000, bytesSent: 500 });
      tracker.updateNetworkMetrics({ packetsLost: 5 });
      tracker.updateNetworkMetrics({ roundTripTime: 50 });

      const metrics = tracker.getNetworkMetrics();
      expect(metrics.bytesReceived).toBe(1000);
      expect(metrics.bytesSent).toBe(500);
      expect(metrics.packetsLost).toBe(5);
      expect(metrics.roundTripTime).toBe(50);
    });

    it('should keep only last 100 RTT measurements', () => {
      for (let i = 0; i < 150; i++) {
        tracker.updateNetworkMetrics({ roundTripTime: i });
      }

      const metrics = tracker.getNetworkMetrics();
      // Should store the latest value (149)
      expect(metrics.roundTripTime).toBe(149);
    });
  });

  describe('Diagnostics Report Generation', () => {
    it('should generate complete diagnostics report', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Record some data
      tracker.setConnectionState('connected');
      tracker.recordHeartbeatSent();
      tracker.recordFrame('I', 2000);
      tracker.recordFrame('P', 1000);
      tracker.updateJitterBuffer(100, 5);
      tracker.updateNetworkMetrics({
        bytesReceived: 1000,
        bytesSent: 500,
        packetsLost: 2,
        roundTripTime: 50,
      });

      const report = tracker.generateReport();

      expect(report.timestamp).toBe(now);
      expect(report.deviceId).toBe(deviceId);
      expect(report.heartbeat).toBeDefined();
      expect(report.connection).toBeDefined();
      expect(report.frame).toBeDefined();
      expect(report.jitterBuffer).toBeDefined();
      expect(report.network).toBeDefined();

      expect(report.connection.connectionState).toBe('connected');
      expect(report.heartbeat.heartbeatCount).toBe(1);
      expect(report.frame.totalFrames).toBe(2);
      expect(report.jitterBuffer.bufferSize).toBe(100);
      expect(report.network.bytesReceived).toBe(1000);
    });

    it('should include all metric categories in report', () => {
      const report = tracker.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('deviceId');
      expect(report).toHaveProperty('heartbeat');
      expect(report).toHaveProperty('connection');
      expect(report).toHaveProperty('frame');
      expect(report).toHaveProperty('jitterBuffer');
      expect(report).toHaveProperty('network');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Record various data
      tracker.setConnectionState('connected');
      tracker.recordHeartbeatSent();
      tracker.recordHeartbeatResponse(50);
      tracker.recordFrame('I', 1000);
      tracker.recordFrameDrop();
      tracker.updateJitterBuffer(100, 5);
      tracker.updateNetworkMetrics({ bytesReceived: 1000 });

      // Reset
      tracker.reset();

      // Verify all metrics are reset
      const heartbeat = tracker.getHeartbeatMetrics();
      expect(heartbeat.heartbeatCount).toBe(0);
      expect(heartbeat.missedHeartbeats).toBe(0);
      expect(heartbeat.averageLatency).toBe(0);

      const connection = tracker.getConnectionMetrics();
      expect(connection.connectionState).toBe('disconnected');
      expect(connection.reconnectCount).toBe(0);

      const frame = tracker.getFrameMetrics();
      expect(frame.totalFrames).toBe(0);
      expect(frame.frameDrops).toBe(0);

      const jitter = tracker.getJitterBufferMetrics();
      expect(jitter.bufferSize).toBe(0);
      expect(jitter.bufferUnderflows).toBe(0);

      const network = tracker.getNetworkMetrics();
      expect(network.bytesReceived).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle zero latency measurements gracefully', () => {
      const metrics = tracker.getHeartbeatMetrics();
      expect(metrics.averageLatency).toBe(0);
    });

    it('should handle zero jitter values gracefully', () => {
      const metrics = tracker.getJitterBufferMetrics();
      expect(metrics.averageJitter).toBe(0);
      expect(metrics.maxJitter).toBe(0);
    });

    it('should handle zero frame times for FPS calculation', () => {
      tracker.recordFrame('P', 1000);
      const metrics = tracker.getFrameMetrics();
      expect(metrics.fps).toBe(0);
    });

    it('should handle connection metrics before any connections', () => {
      const metrics = tracker.getConnectionMetrics();
      expect(metrics.connectionUptime).toBe(0);
      expect(metrics.totalDowntime).toBe(0);
    });
  });
});
