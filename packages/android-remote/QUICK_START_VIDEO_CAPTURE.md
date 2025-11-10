# Quick Start Guide: Video Capture

## Overview

This guide explains how to use the video capture functionality in the Castmill Android Remote Control service.

## Prerequisites

1. Android device running API 26+ (Android 8.0 Oreo or later)
2. MediaProjection permission granted by user
3. Active RemoteControlService with WebSocket connection

## Integration Steps

### 1. Request MediaProjection Permission

In your activity (e.g., MainActivity):

```kotlin
import android.media.projection.MediaProjectionManager

class MainActivity : AppCompatActivity() {
    private lateinit var mediaProjectionManager: MediaProjectionManager
    private val REQUEST_MEDIA_PROJECTION = 1001
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }
    
    fun requestScreenCapture() {
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
    }
}
```

### 2. Start Service with Screen Capture

After receiving permission, start RemoteControlService with screen capture:

```kotlin
override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    
    if (requestCode == REQUEST_MEDIA_PROJECTION && resultCode == RESULT_OK && data != null) {
        // Start RemoteControlService with screen capture
        val intent = Intent(this, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, sessionId)
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_RESULT_CODE, resultCode)
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_DATA, data)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}
```

### 3. Service Automatically Handles Encoding

The RemoteControlService will:
1. Initialize ScreenCaptureManager
2. Try H.264 encoding first
3. Fall back to MJPEG if H.264 fails
4. Stream frames via WebSocket automatically

## Backend Integration

### Receiving Video Frames

Video frames are sent as binary WebSocket messages with this format:

```
[4 bytes: metadata length]
[N bytes: metadata JSON]
[M bytes: video data]
```

### Example Backend Handler (Elixir/Phoenix)

```elixir
def handle_in("video_frame", payload, socket) do
  # payload is a binary message
  
  <<metadata_length::32, rest::binary>> = payload
  <<metadata_json::binary-size(metadata_length), video_data::binary>> = rest
  
  metadata = Jason.decode!(metadata_json)
  
  # metadata contains:
  # - "type": "video_frame"
  # - "codec": "h264" or "mjpeg"
  # - "is_key_frame": true/false
  # - "timestamp": milliseconds
  # - "size": bytes
  
  # Process video_data (NAL units for H.264, JPEG for MJPEG)
  process_video_frame(video_data, metadata)
  
  {:noreply, socket}
end
```

### Decoding H.264 NAL Units

For H.264 streams, you'll receive NAL units that can be decoded using:
- **FFmpeg**: libavcodec
- **Browser**: MediaSource Extensions (MSE)
- **GStreamer**: h264parse + decoder

Example with FFmpeg:

```bash
# Save NAL units to file
ffmpeg -i stream.h264 -c copy output.mp4
```

### Decoding MJPEG Frames

For MJPEG streams, each frame is a complete JPEG image:

```javascript
// In browser
const blob = new Blob([videoData], { type: 'image/jpeg' });
const url = URL.createObjectURL(blob);
imageElement.src = url;
```

## Monitoring and Debugging

### Check Encoder Type

```kotlin
val encoderType = screenCaptureManager.getEncoderType()
Log.i(TAG, "Using encoder: $encoderType") // "H.264" or "MJPEG"
```

### Get Encoder Info

```kotlin
val info = screenCaptureManager.getEncoderInfo()
// Returns map with:
// - "codec": "video/avc" or "MJPEG"
// - "width": 1280
// - "height": 720
// - "frameRate": 15 or 5
// - "isCapturing": true/false
```

### Logs to Monitor

```bash
adb logcat -s VideoEncoder:V MjpegEncoder:V ScreenCaptureManager:V RemoteControlService:V
```

Expected logs:
- `VideoEncoder: VideoEncoder initialized: 1280x720 @ 15fps, 2Mbps`
- `ScreenCaptureManager: H.264 encoding started`
- Or: `ScreenCaptureManager: MJPEG encoding started`

## Troubleshooting

### Problem: Permission Denied

**Symptom**: MediaProjection permission dialog doesn't appear or is denied.

**Solution**:
1. Ensure FOREGROUND_SERVICE_MEDIA_PROJECTION permission in manifest
2. Request permission from an Activity (not Service)
3. Check Android version >= 26

### Problem: Black Screen Captured

**Symptom**: Frames are transmitted but show black content.

**Solution**:
1. Verify VirtualDisplay was created successfully
2. Check that surface is attached to encoder
3. Some apps may block screen capture (DRM content)

### Problem: High Battery Drain

**Symptom**: Device battery drains quickly during capture.

**Solution**:
1. Verify H.264 hardware encoding is used (not MJPEG)
2. Reduce frame rate to 10 fps
3. Lower bitrate to 1.5 Mbps
4. Stop capture when not in use

### Problem: Frames Not Received

**Symptom**: Encoder starts but backend receives no frames.

**Solution**:
1. Check WebSocket connection status
2. Verify binary message support in backend
3. Check network bandwidth availability
4. Review backend logs for errors

## Performance Guidelines

### Recommended Settings by Use Case

**Live Monitoring** (default):
- H.264 @ 720p, 15 fps, 2 Mbps
- Good quality, reasonable bandwidth

**Low Bandwidth**:
- H.264 @ 720p, 10 fps, 1.5 Mbps
- Reduced motion smoothness, lower bandwidth

**Fallback Only**:
- MJPEG @ 720p, 5 fps
- Higher bandwidth, lower frame rate

### Network Bandwidth Requirements

| Codec | Frame Rate | Approx. Bandwidth | Data per Minute |
|-------|------------|-------------------|-----------------|
| H.264 | 15 fps | 2 Mbps | 15 MB |
| H.264 | 10 fps | 1.5 Mbps | 11 MB |
| MJPEG | 5 fps | ~375 KB/s | 22 MB |

## Advanced Usage

### Custom Encoding Parameters

While not exposed in the default API, you can modify encoding parameters by editing the ScreenCaptureManager class:

```kotlin
// In ScreenCaptureManager.kt
private const val TARGET_WIDTH = 1280  // Change resolution
private const val TARGET_HEIGHT = 720
private const val H264_FRAME_RATE = 15  // Change frame rate
private const val H264_BITRATE = 2_000_000  // Change bitrate
```

### Force MJPEG Encoding

For testing or compatibility, you can force MJPEG:

```kotlin
// In ScreenCaptureManager.kt, change:
private var useH264 = false  // Force MJPEG
```

## Security Notes

⚠️ **Important Security Considerations**:

1. **Privacy**: Screen capture records ALL device content
2. **Permissions**: Requires sensitive MediaProjection permission
3. **Deployment**: Only use on managed devices in controlled environments
4. **Encryption**: Always use WSS (WebSocket Secure) in production
5. **Authentication**: Verify device token and session ID on backend

## Next Steps

1. ✅ Set up MediaProjection permission flow
2. ✅ Start RemoteControlService with capture enabled
3. ✅ Implement backend video frame handler
4. ✅ Set up video decoder (FFmpeg, MSE, etc.)
5. ✅ Monitor performance and adjust parameters

For complete technical details, see [VIDEO_CAPTURE_IMPLEMENTATION.md](VIDEO_CAPTURE_IMPLEMENTATION.md).
