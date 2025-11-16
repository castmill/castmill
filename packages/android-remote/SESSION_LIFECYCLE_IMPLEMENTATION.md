# Session Lifecycle and Media WebSocket Implementation Summary

## Overview

This implementation adds support for session lifecycle management and dedicated media WebSocket channel handling in the android-remote package, enabling the backend to initiate screen capture sessions and stream video data over a separate WebSocket channel.

## Issue Requirements

✅ **On receiving start_session event:**
- Initialize MediaProjection (if permission already granted)
- 🚧 Launch user consent (requires MainActivity interaction - stored for future implementation)
- Start encoder (H.264/MJPEG)
- Open media WebSocket: `wss://<backend>/socket/websocket` on channel `device_media:#{device_id}:#{session_id}`

## Implementation Details

### 1. WebSocketManager - Control Channel (Modified)

**File:** `WebSocketManager.kt`

**Changes:**
- Added `onStartSession: ((String) -> Unit)?` callback parameter
- Added `handleStartSession()` method to process start_session events
- Updated Phoenix protocol message handler to recognize `start_session` event
- Callback invoked with session ID when start_session is received

**Key Code:**
```kotlin
class WebSocketManager(
    // ... existing parameters
    private val onStartSession: ((String) -> Unit)? = null
) {
    private fun handleStartSession(payload: JsonObject?) {
        val sid = sessionId
        if (sid == null) {
            Log.e(TAG, "Cannot handle start_session: sessionId is null")
            return
        }
        Log.i(TAG, "Handling start_session for session: $sid")
        onStartSession?.invoke(sid)
    }
}
```

### 2. MediaWebSocketManager - Media Channel (New)

**File:** `MediaWebSocketManager.kt` (New)

**Purpose:** Handle dedicated WebSocket connection for media streaming

**Features:**
- Connects to `device_media:#{device_id}:#{session_id}` channel
- Phoenix channel protocol implementation for media channel
- Binary frame transmission with metadata
- Independent reconnection logic with exponential backoff
- Heartbeat to keep connection alive

**Binary Frame Format:**
```
[metadata_length: 4 bytes][metadata JSON][video data]

Metadata JSON:
{
  "type": "video_frame",
  "codec": "h264" | "mjpeg",
  "is_key_frame": true | false,
  "timestamp": milliseconds,
  "size": bytes
}
```

**Key Methods:**
- `connect()` - Establish WebSocket connection
- `sendVideoFrame(buffer, isKeyFrame, codecType)` - Stream video frames
- `sendMediaMetadata(width, height, fps, codec)` - Send stream metadata
- `disconnect()` - Clean disconnection

### 3. RemoteControlService - Coordinator (Modified)

**File:** `RemoteControlService.kt`

**Changes:**
- Added `mediaWebSocketManager: MediaWebSocketManager?` field
- Added `sessionId: String?` and `pendingSessionId: String?` for state tracking
- Updated `connectWebSocket()` to pass `onStartSession` callback
- Added `handleStartSessionRequest(sessionId)` to handle start_session event
- Added `startMediaCapture(resultCode, data, sessionId)` to coordinate media streaming
- Refactored `startScreenCapture()` to use session tracking
- Updated `onDestroy()` to cleanup media WebSocket

**Session Flow:**
1. Service starts and connects to `device_rc:#{device_id}` channel
2. Backend sends `start_session` event
3. `onStartSession` callback invoked
4. `handleStartSessionRequest()` checks for MediaProjection permission
5. If permission available, `startMediaCapture()` is called
6. Media WebSocket connects to `device_media:#{device_id}:#{session_id}`
7. ScreenCaptureManager starts encoding
8. Frames sent via MediaWebSocketManager

**Key Code:**
```kotlin
private fun connectWebSocket(sessionId: String, deviceToken: String) {
    webSocketManager = WebSocketManager(
        // ... parameters
        onStartSession = { sid ->
            handleStartSessionRequest(sid)
        }
    )
}

private fun startMediaCapture(resultCode: Int, data: Intent, sessionId: String) {
    // Initialize media WebSocket
    mediaWebSocketManager = MediaWebSocketManager(...)
    mediaWebSocketManager?.connect()
    
    // Start screen capture
    screenCaptureManager = ScreenCaptureManager(
        onFrameEncoded = { buffer, isKeyFrame, codecType ->
            mediaWebSocketManager?.sendVideoFrame(buffer, isKeyFrame, codecType)
        }
    )
    screenCaptureManager?.start()
}
```

### 4. Tests (New)

**Files:**
- `MediaWebSocketManagerTest.kt` - Tests for media WebSocket manager
- `SessionLifecycleTest.kt` - Tests for session lifecycle handling

**Test Coverage:**
- MediaWebSocketManager creation
- Topic format validation (`device_media:#{device_id}:#{session_id}`)
- Start session callback invocation
- Session ID format validation
- Disconnection and cleanup

## Protocol Flow

### Complete Session Lifecycle

```
1. Dashboard User → Creates RC Session → Backend creates session
2. Backend → Notifies Device → Push notification or polling
3. Device → MainActivity → Starts RemoteControlService with sessionId
4. RemoteControlService → Connects to device_rc:#{device_id} channel
5. Backend → Sends start_session event → device_rc channel
6. Device → WebSocketManager receives start_session
7. Device → onStartSession callback → handleStartSessionRequest()
8. Device → Checks MediaProjection permission
   - If not granted: Request via MainActivity or notification
   - If granted: Proceed to media capture
9. Device → startMediaCapture() → Initialize MediaWebSocketManager
10. MediaWebSocketManager → Connects to device_media:#{device_id}:#{session_id}
11. Device → Start ScreenCaptureManager → Begin encoding
12. Device → Stream frames → MediaWebSocketManager → Backend → RC Window
```

### Channel Architecture

**Control Channel:** `device_rc:#{device_id}`
- Bidirectional control messages
- Gesture injection commands
- Session lifecycle events
- Device status updates

**Media Channel:** `device_media:#{device_id}:#{session_id}`
- Unidirectional media streaming
- Binary video frames
- Media metadata updates
- Independent from control channel

## Key Improvements

### 1. Separation of Concerns
- Control and media traffic on separate WebSocket connections
- Independent reconnection logic per channel
- Cleaner protocol handling

### 2. Session State Management
- Explicit session ID tracking
- Pending session support for delayed MediaProjection
- Clear lifecycle transitions

### 3. Flexible Permission Flow
- Supports pre-granted MediaProjection (via MainActivity)
- Ready for dynamic permission request (future enhancement)
- Graceful handling of missing permissions

### 4. Backend Protocol Alignment
- Matches backend channel structure (DeviceRcChannel, DeviceMediaChannel)
- Compatible with PubSub relay architecture
- Follows Phoenix channel protocol

## Usage Example

### Starting a Session with Media Capture

```kotlin
// In MainActivity after MediaProjection permission granted
val intent = Intent(this, RemoteControlService::class.java).apply {
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

### Backend Triggering Start Session

```elixir
# Backend sends start_session event to device
Phoenix.PubSub.broadcast(
  Castmill.PubSub,
  "rc_session:#{session_id}",
  %{event: "start_session"}
)
```

## Limitations and Future Work

### Current Limitations

1. **MediaProjection Permission**
   - Currently expects permission to be granted before service start
   - Cannot dynamically request permission from background service
   - User must grant via MainActivity

2. **Error Recovery**
   - Basic reconnection logic
   - Could be enhanced with more sophisticated retry strategies

3. **Permission Request Flow**
   - Logs warning when permission not available
   - Could show notification to guide user to MainActivity
   - Could use transparent activity pattern for permission request

### Future Enhancements

1. **Dynamic Permission Request**
   - Implement notification-based permission request
   - Use transparent activity to request MediaProjection on-demand
   - Store pending sessions and resume after permission grant

2. **Enhanced Monitoring**
   - Add session state metrics
   - Track media channel health separately
   - Monitor frame delivery latency

3. **Adaptive Streaming**
   - Adjust quality based on network conditions
   - Dynamic bitrate control
   - Frame rate adaptation

4. **Multi-Session Support**
   - Handle multiple concurrent sessions
   - Session priority management
   - Resource allocation per session

## Testing

### Unit Tests

Run tests:
```bash
cd packages/android-remote/android
./gradlew test
```

Tests verify:
- MediaWebSocketManager creation and configuration
- Session lifecycle callback invocation
- Topic format correctness
- Disconnection cleanup

### Manual Testing

1. Start RemoteControlService with session ID
2. Verify connection to device_rc channel
3. Trigger start_session from backend
4. Verify handleStartSessionRequest is called
5. Grant MediaProjection permission
6. Verify media WebSocket connects
7. Verify video frames streaming
8. Check logs for proper event flow

## Files Changed

### Modified Files
- `packages/android-remote/android/app/src/main/java/com/castmill/androidremote/WebSocketManager.kt`
- `packages/android-remote/android/app/src/main/java/com/castmill/androidremote/RemoteControlService.kt`
- `packages/android-remote/IMPLEMENTATION.md`

### New Files
- `packages/android-remote/android/app/src/main/java/com/castmill/androidremote/MediaWebSocketManager.kt`
- `packages/android-remote/android/app/src/test/java/com/castmill/androidremote/MediaWebSocketManagerTest.kt`
- `packages/android-remote/android/app/src/test/java/com/castmill/androidremote/SessionLifecycleTest.kt`

## Conclusion

This implementation successfully adds session lifecycle management and dedicated media WebSocket channel support to the android-remote package. The backend can now trigger screen capture sessions via the `start_session` event, and video frames stream over a dedicated `device_media` channel, providing cleaner separation of concerns and better scalability for the remote control system.

The architecture follows Android best practices, maintains compatibility with the existing codebase, and provides a solid foundation for future enhancements like dynamic permission requests and adaptive streaming.
