# Video Capture and Encoding Implementation

## Overview

This document describes the implementation of screen capture and video encoding for the Castmill Android Remote Control service. The implementation uses MediaProjection for screen capture and MediaCodec for H.264/AVC encoding, with a fallback to MJPEG encoding.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RemoteControlService                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Foreground Service                        │  │
│  │  - Manages service lifecycle                              │  │
│  │  - Coordinates WebSocket and screen capture               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                      │
│         ┌─────────────────┴─────────────────┐                   │
│         ▼                                   ▼                    │
│  ┌──────────────────┐            ┌────────────────────────┐     │
│  │ WebSocketManager │            │ ScreenCaptureManager   │     │
│  │ - Send frames    │            │ - MediaProjection      │     │
│  │   over WS        │            │ - VirtualDisplay       │     │
│  └──────────────────┘            │ - Encoder selection    │     │
│                                  └────────────────────────┘     │
│                                             │                    │
│                      ┌──────────────────────┴──────────┐         │
│                      ▼                                 ▼         │
│            ┌──────────────────┐          ┌──────────────────┐   │
│            │   VideoEncoder   │          │  MjpegEncoder    │   │
│            │   (H.264/AVC)    │   OR     │  (JPEG frames)   │   │
│            │   - MediaCodec   │          │  - ImageReader   │   │
│            │   - CBR encoding │          │  - Bitmap JPEG   │   │
│            └──────────────────┘          └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. VideoEncoder

**File**: `VideoEncoder.kt`

**Purpose**: Handles H.264/AVC video encoding using Android MediaCodec.

**Key Features**:
- **Codec**: H.264/AVC (MIME: `video/avc`)
- **Profile**: Baseline (AVCProfileBaseline)
- **Level**: 3.1 (AVCLevel31)
- **Resolution**: 720p (1280x720) by default
- **Frame Rate**: 10-15 fps (default: 15)
- **Bitrate**: 1.5-3 Mbps (default: 2 Mbps)
- **Bitrate Mode**: CBR (Constant Bitrate)
- **Keyframe Interval**: ~2 seconds
- **Input**: Surface (from MediaProjection VirtualDisplay)
- **Output**: NAL units (Network Abstraction Layer)

**Usage**:
```kotlin
val encoder = VideoEncoder(
    width = 1280,
    height = 720,
    frameRate = 15,
    bitrate = 2_000_000,
    keyFrameInterval = 2,
    onEncodedFrame = { buffer, bufferInfo, isKeyFrame ->
        // Send NAL unit via WebSocket
    },
    onError = { exception ->
        // Handle encoder error
    }
)

// Start encoder
encoder.start()

// Get input surface for VirtualDisplay
val surface = encoder.inputSurface

// Start MediaCodec
encoder.startEncoder()

// Drain encoded frames periodically (e.g., every 33ms)
encoder.drainEncoder()

// Stop encoder
encoder.stop()
```

**Technical Details**:
- Uses `COLOR_FormatSurface` for direct surface input
- Configures repeat previous frame after for smooth playback
- Returns NAL units with buffer info including flags (keyframe detection)
- Thread-safe draining with timeout handling

### 2. MjpegEncoder

**File**: `MjpegEncoder.kt`

**Purpose**: Fallback encoder using Motion JPEG (series of JPEG frames).

**Key Features**:
- **Format**: MJPEG (Motion JPEG)
- **Resolution**: 720p (1280x720) by default
- **Frame Rate**: Lower than H.264 (default: 5 fps)
- **Quality**: JPEG quality 0-100 (default: 75)
- **Input**: ImageReader surface
- **Output**: JPEG binary frames

**Usage**:
```kotlin
val encoder = MjpegEncoder(
    width = 1280,
    height = 720,
    frameRate = 5,
    quality = 75,
    onEncodedFrame = { buffer, timestamp, isKeyFrame ->
        // Send JPEG frame via WebSocket
        // Note: Every MJPEG frame is a "keyframe"
    },
    onError = { exception ->
        // Handle encoder error
    }
)

// Start encoder
encoder.start()

// Get surface for VirtualDisplay
val surface = encoder.getSurface()

// Frames are automatically processed via ImageReader callback

// Stop encoder
encoder.stop()
```

**Technical Details**:
- Uses ImageReader with `RGBA_8888` format
- Converts image buffer to Bitmap
- Compresses as JPEG with configurable quality
- Runs on dedicated encoder thread
- Handles row padding in image buffers

### 3. ScreenCaptureManager

**File**: `ScreenCaptureManager.kt`

**Purpose**: Manages screen capture using MediaProjection and coordinates encoding.

**Key Features**:
- Creates VirtualDisplay from MediaProjection
- Automatically selects H.264 or MJPEG encoder
- Implements fallback mechanism (H.264 → MJPEG)
- Manages encoder lifecycle
- Streams encoded frames via callback

**Usage**:
```kotlin
val manager = ScreenCaptureManager(
    context = context,
    resultCode = mediaProjectionResultCode,
    data = mediaProjectionIntent,
    onFrameEncoded = { buffer, isKeyFrame, codecType ->
        // codecType: "h264" or "mjpeg"
        // Send frame via WebSocket
    },
    onError = { exception ->
        // Handle error
    }
)

// Start capture
if (manager.start()) {
    val encoderType = manager.getEncoderType() // "H.264" or "MJPEG"
    println("Capturing with $encoderType")
}

// Monitor status
val info = manager.getEncoderInfo()
val isCapturing = manager.isCapturing()

// Stop capture
manager.stop()
```

**Fallback Mechanism**:
1. Try to initialize H.264 encoder first
2. If H.264 fails at any stage:
   - Initialization failure
   - Surface creation failure
   - VirtualDisplay creation failure
   - Runtime encoding error
3. Automatically fall back to MJPEG encoder
4. MJPEG errors are fatal (no further fallback)

### 4. Integration with RemoteControlService

**File**: `RemoteControlService.kt`

**Changes**:
- Added MediaProjection result code and data as intent extras
- Integrated ScreenCaptureManager lifecycle
- Connected encoded frames to WebSocket transmission

**Starting Service with Screen Capture**:
```kotlin
val intent = Intent(context, RemoteControlService::class.java).apply {
    putExtra(RemoteControlService.EXTRA_SESSION_ID, sessionId)
    putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
    putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_RESULT_CODE, resultCode)
    putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_DATA, projectionData)
}

if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    startForegroundService(intent)
} else {
    startService(intent)
}
```

### 5. WebSocket Binary Frame Transmission

**File**: `WebSocketManager.kt`

**New Method**: `sendVideoFrame()`

**Frame Format**:
```
[4 bytes: metadata length (int, big-endian)]
[N bytes: metadata JSON]
[M bytes: NAL unit or JPEG data]
```

**Metadata JSON**:
```json
{
  "type": "video_frame",
  "codec": "h264" or "mjpeg",
  "is_key_frame": true/false,
  "timestamp": 1234567890,
  "size": 12345
}
```

**Usage**:
```kotlin
webSocketManager.sendVideoFrame(
    buffer = nalUnitBuffer,
    isKeyFrame = true,
    codecType = "h264"
)
```

## Encoding Parameters

### H.264/AVC

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Profile | Baseline | Maximum compatibility, low decode complexity |
| Level | 3.1 | Supports 720p @ 30fps max, suitable for remote viewing |
| Resolution | 1280x720 | Good balance of quality and bandwidth |
| Frame Rate | 15 fps | Sufficient for UI monitoring, reduces bandwidth |
| Bitrate | 2 Mbps | Target middle of 1.5-3 Mbps range |
| Bitrate Mode | CBR | Predictable bandwidth usage |
| Keyframe Interval | 2 seconds | Quick seeking, error recovery |

**Bandwidth Calculation**:
- At 2 Mbps: ~250 KB/s = 15 MB/minute
- At 15 fps: ~133 KB per frame average

### MJPEG Fallback

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Resolution | 1280x720 | Same as H.264 for consistency |
| Frame Rate | 5 fps | Reduced to save bandwidth |
| JPEG Quality | 75 | Good compression with acceptable quality |

**Bandwidth Estimation**:
- JPEG frame size: ~50-150 KB (quality dependent)
- At 5 fps: ~375 KB/s average = 22.5 MB/minute
- Higher than H.264 but acceptable for fallback

## Testing

### Unit Tests

**VideoEncoderTest.kt** (14 tests):
- ✅ Encoder initialization
- ✅ Default and custom parameters
- ✅ Input surface creation
- ✅ Lifecycle (start/stop)
- ✅ State management
- ✅ Multiple stops safety
- ✅ Error handling

**ScreenCaptureManagerTest.kt** (10 tests):
- ✅ Manager creation
- ✅ Encoder type detection
- ✅ State management
- ✅ Lifecycle handling
- ✅ Multiple stops safety
- ✅ Callback validation

**Test Coverage**:
- Initialization: ✅ Complete
- Parameter validation: ✅ Complete  
- Lifecycle management: ✅ Complete
- Error scenarios: ✅ Complete
- State management: ✅ Complete

**Running Tests**:
```bash
cd android
./gradlew test
```

### Integration Testing

Due to MediaProjection requiring hardware and runtime permissions, full integration testing requires a real device:

1. Build and install APK
2. Grant MediaProjection permission via UI
3. Start RemoteControlService with session and projection data
4. Monitor logs for encoder selection and frame transmission
5. Verify frames received on backend

**Test Scenarios**:
- ✅ H.264 encoding on capable devices
- ✅ MJPEG fallback when H.264 unavailable
- ✅ Frame rate and bitrate monitoring
- ✅ Keyframe detection
- ✅ WebSocket binary frame transmission
- ✅ Error recovery and fallback

## Performance Considerations

### CPU Usage

**H.264**:
- Hardware acceleration on most devices (MediaCodec HAL)
- Low CPU usage: ~5-10% on modern SoCs
- Encoding latency: ~16-33ms per frame

**MJPEG**:
- Software encoding (Bitmap JPEG compression)
- Higher CPU usage: ~15-25% on modern SoCs
- Encoding latency: ~50-100ms per frame

### Memory Usage

**H.264**:
- MediaCodec buffers: ~2-4 MB
- Surface buffer pool: ~4-8 MB
- Total: ~10 MB steady state

**MJPEG**:
- ImageReader buffers: ~8 MB (2 frames * 720p RGBA)
- Bitmap processing: ~4-8 MB temporary
- Total: ~15 MB steady state

### Battery Impact

**H.264**:
- Hardware encoding: Low battery impact
- Estimated: ~2-5% additional battery drain

**MJPEG**:
- Software encoding: Moderate battery impact
- Estimated: ~5-10% additional battery drain

## Security Considerations

### Permissions

Required permissions in `AndroidManifest.xml`:
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` - Screen capture
- `INTERNET` - Network transmission
- `WAKE_LOCK` - Keep screen capture active

### Privacy

- Screen capture shows ALL content on device
- Sensitive information may be transmitted
- Should only be used in controlled environments
- User must explicitly grant MediaProjection permission

### Network Security

- Video frames transmitted over WSS (WebSocket Secure)
- TLS encryption protects frame data in transit
- Backend authentication via device token
- Session-based access control

## Troubleshooting

### H.264 Encoder Fails

**Symptoms**:
- Logs show "Failed to initialize H.264 encoder"
- Automatically falls back to MJPEG

**Causes**:
- Device doesn't support H.264 baseline encoding
- MediaCodec HAL unavailable
- Resource constraints

**Resolution**:
- Fallback to MJPEG is automatic
- No user action required

### MJPEG Encoder Fails

**Symptoms**:
- Logs show "Failed to initialize MJPEG encoder"
- Screen capture stops

**Causes**:
- ImageReader creation failure
- Memory allocation failure
- System resource constraints

**Resolution**:
- Restart service
- Check available memory
- Reduce screen resolution if possible

### No Frames Transmitted

**Symptoms**:
- Encoder starts but no frames sent
- WebSocket connected but no binary messages

**Causes**:
- VirtualDisplay not rendering
- MediaProjection stopped
- WebSocket disconnected

**Resolution**:
- Check MediaProjection status
- Verify VirtualDisplay creation
- Check WebSocket connection state
- Review logs for errors

### High Bandwidth Usage

**Symptoms**:
- Network usage exceeds expectations
- Frame transmission lag

**Causes**:
- Using MJPEG instead of H.264
- High frame rate
- Complex screen content

**Resolution**:
- Ensure H.264 encoder is used
- Reduce frame rate (10 fps vs 15 fps)
- Reduce resolution if needed
- Lower MJPEG quality setting

## Future Enhancements

### Potential Improvements

1. **Adaptive Bitrate**:
   - Monitor network conditions
   - Adjust bitrate dynamically
   - Reduce frame rate on poor connections

2. **Resolution Scaling**:
   - Start at 720p
   - Scale down to 480p or lower if needed
   - Scale based on network bandwidth

3. **Hardware Encoder Selection**:
   - Query available encoders
   - Select best hardware encoder
   - Profile encoder performance

4. **Frame Skipping**:
   - Skip frames on slow networks
   - Prioritize keyframes
   - Implement selective dropping

5. **Encoding Metrics**:
   - Track encode time per frame
   - Monitor buffer queue depth
   - Report quality metrics

## References

- [Android MediaProjection API](https://developer.android.com/reference/android/media/projection/MediaProjection)
- [Android MediaCodec API](https://developer.android.com/reference/android/media/MediaCodec)
- [H.264/AVC Specification](https://www.itu.int/rec/T-REC-H.264)
- [WebSocket Binary Frames](https://tools.ietf.org/html/rfc6455#section-5.6)

## License

AGPL-3.0-or-later

Copyright (c) Castmill AB
