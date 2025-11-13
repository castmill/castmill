/**
 * DiagnosticsTracker
 *
 * Tracks and reports device diagnostics metrics including:
 * - Heartbeats and connection status
 * - Reconnection attempts and timing
 * - Frame statistics (fps, bitrate, frame drops)
 * - Jitter buffer statistics
 * - Network metrics
 */

export interface HeartbeatMetrics {
  lastHeartbeat: number;
  heartbeatCount: number;
  missedHeartbeats: number;
  averageLatency: number;
}

export interface ConnectionMetrics {
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
  reconnectCount: number;
  lastReconnectAttempt: number;
  totalDowntime: number;
  connectionUptime: number;
}

export interface FrameMetrics {
  fps: number;
  averageBitrate: number;
  frameDrops: number;
  totalFrames: number;
  pFrames: number;
  iFrames: number;
}

export interface JitterBufferMetrics {
  bufferSize: number;
  bufferUnderflows: number;
  bufferOverflows: number;
  averageJitter: number;
  maxJitter: number;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  roundTripTime: number;
}

export interface DiagnosticsReport {
  timestamp: number;
  deviceId: string;
  heartbeat: HeartbeatMetrics;
  connection: ConnectionMetrics;
  frame: FrameMetrics;
  jitterBuffer: JitterBufferMetrics;
  network: NetworkMetrics;
}

export class DiagnosticsTracker {
  private deviceId: string;
  private startTime: number;

  // Heartbeat tracking
  private lastHeartbeat = 0;
  private heartbeatCount = 0;
  private missedHeartbeats = 0;
  private heartbeatLatencies: number[] = [];

  // Connection tracking
  private connectionState: ConnectionMetrics['connectionState'] = 'disconnected';
  private reconnectCount = 0;
  private lastReconnectAttempt = 0;
  private lastConnectionTime = 0;
  private totalDowntime = 0;
  private connectionStartTime = 0;

  // Frame tracking
  private currentFps = 0;
  private averageBitrate = 0;
  private frameDrops = 0;
  private totalFrames = 0;
  private pFrames = 0;
  private iFrames = 0;
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private bitrateHistory: number[] = [];

  // Jitter buffer tracking
  private bufferSize = 0;
  private bufferUnderflows = 0;
  private bufferOverflows = 0;
  private jitterValues: number[] = [];
  private maxJitter = 0;

  // Network tracking
  private bytesReceived = 0;
  private bytesSent = 0;
  private packetsLost = 0;
  private roundTripTime = 0;
  private rttMeasurements: number[] = [];

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.startTime = Date.now();
  }

  /**
   * Record a heartbeat sent to the server
   */
  recordHeartbeatSent(): void {
    this.lastHeartbeat = Date.now();
    this.heartbeatCount++;
  }

  /**
   * Record a heartbeat response received from server
   * @param latency - Time taken for heartbeat round trip in milliseconds
   */
  recordHeartbeatResponse(latency: number): void {
    this.heartbeatLatencies.push(latency);
    // Keep only last 100 measurements
    if (this.heartbeatLatencies.length > 100) {
      this.heartbeatLatencies.shift();
    }
  }

  /**
   * Record a missed heartbeat
   */
  recordMissedHeartbeat(): void {
    this.missedHeartbeats++;
  }

  /**
   * Record a connection state change
   */
  setConnectionState(
    state: ConnectionMetrics['connectionState'],
    timestamp?: number
  ): void {
    const now = timestamp || Date.now();
    const previousState = this.connectionState;
    this.connectionState = state;

    if (state === 'connected' && previousState !== 'connected') {
      this.connectionStartTime = now;
    } else if (state !== 'connected' && previousState === 'connected') {
      // Track downtime
      this.lastConnectionTime = now;
    }

    if (state === 'reconnecting') {
      this.reconnectCount++;
      this.lastReconnectAttempt = now;
    }
  }

  /**
   * Record a rendered frame
   */
  recordFrame(
    frameType: 'I' | 'P',
    bitrate: number,
    timestamp?: number
  ): void {
    const now = timestamp || Date.now();
    this.totalFrames++;

    if (frameType === 'I') {
      this.iFrames++;
    } else {
      this.pFrames++;
    }

    // Calculate FPS
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameTimes.push(frameDelta);
      // Keep only last 60 frame times (1 second at 60fps)
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }

      // Calculate current FPS from average frame time
      const avgFrameTime =
        this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.currentFps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    }

    this.lastFrameTime = now;

    // Track bitrate
    this.bitrateHistory.push(bitrate);
    if (this.bitrateHistory.length > 100) {
      this.bitrateHistory.shift();
    }
    this.averageBitrate =
      this.bitrateHistory.reduce((a, b) => a + b, 0) /
      this.bitrateHistory.length;
  }

  /**
   * Record a dropped frame
   */
  recordFrameDrop(): void {
    this.frameDrops++;
  }

  /**
   * Update jitter buffer metrics
   */
  updateJitterBuffer(
    size: number,
    jitter: number,
    underflow?: boolean,
    overflow?: boolean
  ): void {
    this.bufferSize = size;
    this.jitterValues.push(jitter);

    if (this.jitterValues.length > 100) {
      this.jitterValues.shift();
    }

    if (jitter > this.maxJitter) {
      this.maxJitter = jitter;
    }

    if (underflow) {
      this.bufferUnderflows++;
    }

    if (overflow) {
      this.bufferOverflows++;
    }
  }

  /**
   * Update network metrics
   */
  updateNetworkMetrics(metrics: {
    bytesReceived?: number;
    bytesSent?: number;
    packetsLost?: number;
    roundTripTime?: number;
  }): void {
    if (metrics.bytesReceived !== undefined) {
      this.bytesReceived = metrics.bytesReceived;
    }
    if (metrics.bytesSent !== undefined) {
      this.bytesSent = metrics.bytesSent;
    }
    if (metrics.packetsLost !== undefined) {
      this.packetsLost = metrics.packetsLost;
    }
    if (metrics.roundTripTime !== undefined) {
      this.roundTripTime = metrics.roundTripTime;
      this.rttMeasurements.push(metrics.roundTripTime);
      if (this.rttMeasurements.length > 100) {
        this.rttMeasurements.shift();
      }
    }
  }

  /**
   * Get current heartbeat metrics
   */
  getHeartbeatMetrics(): HeartbeatMetrics {
    const averageLatency =
      this.heartbeatLatencies.length > 0
        ? this.heartbeatLatencies.reduce((a, b) => a + b, 0) /
          this.heartbeatLatencies.length
        : 0;

    return {
      lastHeartbeat: this.lastHeartbeat,
      heartbeatCount: this.heartbeatCount,
      missedHeartbeats: this.missedHeartbeats,
      averageLatency,
    };
  }

  /**
   * Get current connection metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    const now = Date.now();
    let connectionUptime = 0;

    if (this.connectionState === 'connected' && this.connectionStartTime > 0) {
      connectionUptime = now - this.connectionStartTime;
    }

    // Calculate total downtime if we're currently disconnected
    let totalDowntime = this.totalDowntime;
    if (
      this.connectionState !== 'connected' &&
      this.lastConnectionTime > 0
    ) {
      totalDowntime += now - this.lastConnectionTime;
    }

    return {
      connectionState: this.connectionState,
      reconnectCount: this.reconnectCount,
      lastReconnectAttempt: this.lastReconnectAttempt,
      totalDowntime,
      connectionUptime,
    };
  }

  /**
   * Get current frame metrics
   */
  getFrameMetrics(): FrameMetrics {
    return {
      fps: this.currentFps,
      averageBitrate: this.averageBitrate,
      frameDrops: this.frameDrops,
      totalFrames: this.totalFrames,
      pFrames: this.pFrames,
      iFrames: this.iFrames,
    };
  }

  /**
   * Get current jitter buffer metrics
   */
  getJitterBufferMetrics(): JitterBufferMetrics {
    const averageJitter =
      this.jitterValues.length > 0
        ? this.jitterValues.reduce((a, b) => a + b, 0) /
          this.jitterValues.length
        : 0;

    return {
      bufferSize: this.bufferSize,
      bufferUnderflows: this.bufferUnderflows,
      bufferOverflows: this.bufferOverflows,
      averageJitter,
      maxJitter: this.maxJitter,
    };
  }

  /**
   * Get current network metrics
   */
  getNetworkMetrics(): NetworkMetrics {
    return {
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      packetsLost: this.packetsLost,
      roundTripTime: this.roundTripTime,
    };
  }

  /**
   * Generate a complete diagnostics report
   */
  generateReport(): DiagnosticsReport {
    return {
      timestamp: Date.now(),
      deviceId: this.deviceId,
      heartbeat: this.getHeartbeatMetrics(),
      connection: this.getConnectionMetrics(),
      frame: this.getFrameMetrics(),
      jitterBuffer: this.getJitterBufferMetrics(),
      network: this.getNetworkMetrics(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastHeartbeat = 0;
    this.heartbeatCount = 0;
    this.missedHeartbeats = 0;
    this.heartbeatLatencies = [];
    this.connectionState = 'disconnected';
    this.reconnectCount = 0;
    this.lastReconnectAttempt = 0;
    this.lastConnectionTime = 0;
    this.totalDowntime = 0;
    this.connectionStartTime = 0;
    this.currentFps = 0;
    this.averageBitrate = 0;
    this.frameDrops = 0;
    this.totalFrames = 0;
    this.pFrames = 0;
    this.iFrames = 0;
    this.lastFrameTime = 0;
    this.frameTimes = [];
    this.bitrateHistory = [];
    this.bufferSize = 0;
    this.bufferUnderflows = 0;
    this.bufferOverflows = 0;
    this.jitterValues = [];
    this.maxJitter = 0;
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.packetsLost = 0;
    this.roundTripTime = 0;
    this.rttMeasurements = [];
  }
}
