# Android Remote Diagnostics, Resilience, and Security

## Overview

This implementation adds comprehensive diagnostics tracking, backpressure handling, and security features to the Castmill device package, specifically targeting android-remote connectivity. The solution provides real-time metrics reporting, intelligent frame management, and secure WebSocket communications.

## Architecture

### Components

1. **DiagnosticsTracker** - Tracks and reports device metrics
2. **BackpressureHandler** - Manages frame buffering and dropping
3. **SecureWebSocketConnection** - Provides secure, authenticated WebSocket connections

### Directory Structure

```
packages/device/src/classes/diagnostics/
├── diagnostics-tracker.ts          # Main metrics tracking
├── diagnostics-tracker.test.ts     # 36 unit tests
├── backpressure-handler.ts         # Frame buffer management
├── backpressure-handler.test.ts    # 28 unit tests
├── secure-websocket.ts             # Secure WebSocket connection
├── secure-websocket.test.ts        # 26 unit tests
└── index.ts                        # Module exports
```

## Features

### 1. Diagnostics Tracking

The `DiagnosticsTracker` class provides comprehensive metrics collection:

#### Heartbeat Metrics
- Heartbeat count and timing
- Average latency calculation
- Missed heartbeat tracking
- Last heartbeat timestamp

```typescript
import { DiagnosticsTracker } from '@castmill/device';

const tracker = new DiagnosticsTracker('device-id');

// Record heartbeats
tracker.recordHeartbeatSent();
tracker.recordHeartbeatResponse(50); // 50ms latency
tracker.recordMissedHeartbeat();

// Get metrics
const metrics = tracker.getHeartbeatMetrics();
console.log(metrics);
// {
//   lastHeartbeat: 1234567890,
//   heartbeatCount: 10,
//   missedHeartbeats: 2,
//   averageLatency: 52.3
// }
```

#### Connection Metrics
- Connection state tracking
- Reconnection attempts
- Uptime and downtime calculation
- Connection history

```typescript
// Track connection state
tracker.setConnectionState('connected');
tracker.setConnectionState('reconnecting');
tracker.setConnectionState('connected');

const metrics = tracker.getConnectionMetrics();
// {
//   connectionState: 'connected',
//   reconnectCount: 1,
//   lastReconnectAttempt: 1234567890,
//   totalDowntime: 5000,
//   connectionUptime: 120000
// }
```

#### Frame Metrics
- FPS calculation from frame timing
- Average bitrate tracking
- Frame drop counting
- I-frame and P-frame statistics

```typescript
// Record frames
tracker.recordFrame('I', 2000); // I-frame, 2000 bytes
tracker.recordFrame('P', 500);  // P-frame, 500 bytes
tracker.recordFrameDrop();

const metrics = tracker.getFrameMetrics();
// {
//   fps: 60,
//   averageBitrate: 1500,
//   frameDrops: 1,
//   totalFrames: 2,
//   pFrames: 1,
//   iFrames: 1
// }
```

#### Jitter Buffer Metrics
- Buffer size tracking
- Underflow and overflow detection
- Jitter calculation and history

```typescript
tracker.updateJitterBuffer(
  100,  // buffer size
  5,    // jitter in ms
  false, // underflow?
  false  // overflow?
);

const metrics = tracker.getJitterBufferMetrics();
// {
//   bufferSize: 100,
//   bufferUnderflows: 0,
//   bufferOverflows: 0,
//   averageJitter: 5,
//   maxJitter: 5
// }
```

#### Network Metrics
- Bytes sent/received
- Packet loss tracking
- Round-trip time (RTT) measurement

```typescript
tracker.updateNetworkMetrics({
  bytesReceived: 1000000,
  bytesSent: 50000,
  packetsLost: 5,
  roundTripTime: 50
});
```

#### Complete Diagnostics Report

```typescript
const report = tracker.generateReport();
// Returns comprehensive report with all metrics
// {
//   timestamp: 1234567890,
//   deviceId: 'device-id',
//   heartbeat: { ... },
//   connection: { ... },
//   frame: { ... },
//   jitterBuffer: { ... },
//   network: { ... }
// }
```

### 2. Backpressure Handling

The `BackpressureHandler` class implements intelligent frame dropping to prevent buffer overflow:

#### Features
- Configurable buffer size and drop threshold
- Automatic P-frame dropping when capacity is reached
- I-frame preservation (required for decoding)
- Oldest-first dropping strategy
- Buffer utilization tracking

```typescript
import { BackpressureHandler } from '@castmill/device';

const handler = new BackpressureHandler({
  maxBufferSize: 10 * 1024 * 1024, // 10MB
  maxFrames: 100,
  dropThreshold: 0.8, // Start dropping at 80%
  minIFrameInterval: 2000 // 2 seconds
});

// Add frames
const added = handler.addFrame({
  type: 'P',
  timestamp: Date.now(),
  size: 50000,
  data: frameData
});

if (!added) {
  console.log('Frame was dropped due to backpressure');
}

// Retrieve frames for playback
const frame = handler.getNextFrame();

// Check metrics
const metrics = handler.getMetrics();
// {
//   bufferedFrames: 25,
//   bufferedBytes: 1250000,
//   droppedFrames: 5,
//   lastDropTimestamp: 1234567890,
//   bufferUtilization: 0.75
// }
```

#### Backpressure Algorithm

1. **Threshold Check**: When adding a frame, check if it would exceed the drop threshold
2. **Drop Oldest P-Frames**: Drop P-frames starting from the oldest in the buffer
3. **Preserve I-Frames**: Never drop I-frames as they're required for decoding
4. **Continue Until Below Threshold**: Keep dropping until utilization is below threshold
5. **Reject Frame if Necessary**: If no P-frames can be dropped and buffer is full, reject the incoming frame

### 3. Secure WebSocket Connection

The `SecureWebSocketConnection` class provides secure, authenticated WebSocket communications:

#### Security Features
- **WSS Enforcement**: Requires wss:// in production (allows ws://localhost in development)
- **TLS Certificate Validation**: Platform-level certificate validation
- **Device Token Authentication**: Token-based authentication with each connection
- **Replay Attack Prevention**: Timestamp included with auth parameters
- **Certificate Pinning Support**: Placeholder for native implementation
- **Exponential Backoff**: Intelligent reconnection strategy

```typescript
import { SecureWebSocketConnection } from '@castmill/device';

const connection = new SecureWebSocketConnection({
  deviceId: 'device-123',
  deviceToken: 'secret-token',
  hardwareId: 'hw-456',
  endpoint: 'wss://api.castmill.com/socket',
  validateCertificates: true,
  allowSelfSignedCerts: false,
  pinnedCertificates: [
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  ]
});

// Connect
await connection.connect();

// Get Phoenix socket for channel operations
const socket = connection.getSocket();
const channel = socket.channel('device:123', {});

// Monitor connection status
const status = connection.getStatus();
// {
//   state: 'connected',
//   lastConnectAttempt: 1234567890,
//   lastSuccessfulConnect: 1234567890,
//   certificateValid: true
// }

// Token rotation
connection.updateToken('new-token');

// Disconnect
connection.disconnect();
```

#### Endpoint Validation

```typescript
import { validateSecureEndpoint } from '@castmill/device';

// Production
validateSecureEndpoint('wss://api.castmill.com/socket'); // true
validateSecureEndpoint('ws://api.castmill.com/socket');  // false

// Development (localhost only)
validateSecureEndpoint('ws://localhost:4000/socket');    // true
validateSecureEndpoint('ws://127.0.0.1:4000/socket');    // true
validateSecureEndpoint('ws://192.168.1.1:4000/socket');  // true
```

#### Authentication Parameters

```typescript
import { generateAuthParams } from '@castmill/device';

const params = generateAuthParams({
  deviceId: 'device-123',
  deviceToken: 'token-456',
  hardwareId: 'hw-789',
  endpoint: 'wss://api.castmill.com/socket'
});

// {
//   device_id: 'device-123',
//   token: 'token-456',
//   hardware_id: 'hw-789',
//   timestamp: 1234567890
// }
```

## Integration Example

Here's how to integrate all components:

```typescript
import {
  DiagnosticsTracker,
  BackpressureHandler,
  SecureWebSocketConnection,
} from '@castmill/device';

// Initialize components
const tracker = new DiagnosticsTracker('device-id');
const frameBuffer = new BackpressureHandler({
  maxBufferSize: 10 * 1024 * 1024,
  maxFrames: 100,
  dropThreshold: 0.8,
});

// Establish secure connection
const connection = new SecureWebSocketConnection({
  deviceId: 'device-123',
  deviceToken: process.env.DEVICE_TOKEN,
  endpoint: 'wss://api.castmill.com/socket',
});

await connection.connect();
tracker.setConnectionState('connected');

const socket = connection.getSocket();
const channel = socket.channel('device:123', {});

// Set up heartbeat
setInterval(() => {
  tracker.recordHeartbeatSent();
  const startTime = Date.now();
  
  channel.push('heartbeat', {})
    .receive('ok', () => {
      const latency = Date.now() - startTime;
      tracker.recordHeartbeatResponse(latency);
    })
    .receive('error', () => {
      tracker.recordMissedHeartbeat();
    });
}, 30000);

// Report diagnostics every minute
setInterval(() => {
  const report = tracker.generateReport();
  channel.push('diagnostics', report);
}, 60000);

// Handle incoming frames
channel.on('frame', (frameData) => {
  const added = frameBuffer.addFrame({
    type: frameData.type,
    timestamp: Date.now(),
    size: frameData.size,
    data: frameData.data,
  });

  if (added) {
    tracker.recordFrame(frameData.type, frameData.size);
  } else {
    tracker.recordFrameDrop();
  }
});

// Playback loop
setInterval(() => {
  const frame = frameBuffer.getNextFrame();
  if (frame) {
    renderFrame(frame);
  }
}, 16.67); // 60 FPS
```

## Testing

### Running Tests

```bash
# Run all diagnostics tests
yarn workspace @castmill/device test src/classes/diagnostics

# Run specific test file
yarn workspace @castmill/device test diagnostics-tracker.test.ts
```

### Test Coverage

- **DiagnosticsTracker**: 36 tests covering all metric types
- **BackpressureHandler**: 28 tests covering frame management and edge cases
- **SecureWebSocketConnection**: 26 tests covering security and connectivity

**Total: 90 tests, all passing**

### Test Categories

1. **Unit Tests**: Individual component functionality
2. **Error Handling**: Graceful degradation and error scenarios
3. **Edge Cases**: Boundary conditions and unusual inputs
4. **Integration Scenarios**: Component interaction patterns

## Security Considerations

### Certificate Pinning

Certificate pinning is supported at the API level but requires native implementation:

```typescript
// For Android (Capacitor plugin)
// Implement in Java/Kotlin:
// - Load pinned certificates from configuration
// - Override SSLSocketFactory
// - Validate certificate fingerprints during TLS handshake

// For iOS (Capacitor plugin)
// Implement in Swift/Objective-C:
// - Use URLSession delegate methods
// - Implement certificate pinning in didReceive challenge
// - Validate certificate chain and fingerprints
```

### Token Management

- Tokens should be rotated periodically
- Use `updateToken()` method for seamless token rotation
- Tokens are included in connection parameters automatically
- Timestamps prevent replay attacks

### TLS Best Practices

1. Always use wss:// in production
2. Validate server certificates
3. Never allow self-signed certificates in production
4. Implement certificate pinning for critical applications
5. Use exponential backoff for reconnections

## Performance Optimization

### Buffer Management

```typescript
// Optimize buffer size based on network conditions
if (tracker.getNetworkMetrics().roundTripTime > 100) {
  frameBuffer.updateConfig({
    maxBufferSize: 15 * 1024 * 1024, // Increase buffer
    dropThreshold: 0.85, // More aggressive dropping
  });
}
```

### Metrics Reporting

```typescript
// Adjust reporting frequency based on connection quality
const connectionMetrics = tracker.getConnectionMetrics();
const reportInterval = connectionMetrics.reconnectCount > 5
  ? 120000 // 2 minutes if unstable
  : 60000; // 1 minute if stable
```

## Troubleshooting

### High Frame Drop Rate

```typescript
const metrics = frameBuffer.getMetrics();
if (metrics.droppedFrames / metrics.bufferedFrames > 0.1) {
  // More than 10% frames dropped
  console.warn('High frame drop rate detected');
  
  // Possible solutions:
  // 1. Increase buffer size
  // 2. Request lower bitrate from server
  // 3. Check network quality
}
```

### Connection Issues

```typescript
const status = connection.getStatus();
if (status.state === 'error') {
  console.error('Connection error:', status.error);
  
  if (!status.certificateValid) {
    // TLS certificate validation failed
    console.error('Certificate validation failed');
    // Check: endpoint URL, certificate validity, system time
  }
}
```

### High Latency

```typescript
const heartbeat = tracker.getHeartbeatMetrics();
if (heartbeat.averageLatency > 200) {
  // High latency detected (>200ms)
  console.warn('High network latency');
  
  // Adjust buffer and thresholds
  frameBuffer.updateConfig({
    maxBufferSize: 20 * 1024 * 1024,
    dropThreshold: 0.9,
  });
}
```

## Future Enhancements

1. **Native Certificate Pinning**: Implement platform-specific certificate pinning
2. **Adaptive Bitrate**: Adjust streaming quality based on metrics
3. **Predictive Buffering**: Use ML to predict buffer requirements
4. **Advanced Jitter Handling**: Implement adaptive jitter buffer algorithms
5. **Compression**: Add frame compression to reduce bandwidth
6. **Multi-Channel Support**: Support multiple concurrent channels
7. **Metrics Visualization**: Dashboard for real-time metrics monitoring

## References

- [Phoenix Channels Documentation](https://hexdocs.pm/phoenix/channels.html)
- [WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [Certificate Pinning](https://owasp.org/www-community/controls/Certificate_and_Public_Key_Pinning)
- [Backpressure Handling](https://en.wikipedia.org/wiki/Back_pressure)
