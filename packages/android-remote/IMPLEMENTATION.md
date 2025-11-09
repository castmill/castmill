# RemoteService Implementation

This document describes the implementation of the RemoteService as a foreground service with WebSocket connectivity to the Castmill backend.

## Overview

The RemoteService implementation consists of three main components:

1. **WebSocketManager** - Handles WebSocket connectivity using Phoenix protocol
2. **RemoteControlService** - Foreground service that manages the WebSocket connection
3. **DeviceUtils** - Provides device identification (already implemented)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RemoteControlService                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Foreground Service                    │  │
│  │  - Persistent notification (Android 10+ compliant)    │  │
│  │  - Lifecycle management                               │  │
│  │  - Configuration storage                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  WebSocketManager                      │  │
│  │  - Phoenix WebSocket protocol                         │  │
│  │  - Automatic reconnection with backoff                │  │
│  │  - Heartbeat to keep connection alive                 │  │
│  │  - Event routing (control/device events)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │  Castmill Backend       │
              │  device_rc:#{device_id} │
              └─────────────────────────┘
```

## Component Details

### WebSocketManager

**File**: `WebSocketManager.kt`

**Responsibilities**:
- Establish WebSocket connection to backend
- Implement Phoenix channel protocol
- Handle automatic reconnection with exponential backoff
- Send/receive control and device events
- Maintain heartbeat

**Key Features**:
- Phoenix protocol: Messages are arrays `[join_ref, ref, topic, event, payload]`
- Topic format: `device_rc:#{device_id}`
- Authentication: Sends `token` and `session_id` on join
- Reconnection: Exponential backoff from 1s to 60s max
- Heartbeat: Every 30 seconds to keep connection alive

**Usage**:
```kotlin
val wsManager = WebSocketManager(
    baseUrl = "https://api.castmill.io",
    deviceId = deviceId,
    deviceToken = token,
    coroutineScope = lifecycleScope
)
wsManager.connect(sessionId)
```

### RemoteControlService

**File**: `RemoteControlService.kt`

**Responsibilities**:
- Run as foreground service (Android 10+ compliant)
- Compute device ID using `DeviceUtils.getDeviceId()`
- Initialize and manage WebSocket connection
- Display persistent notification with connection status
- Store device token for future use
- Handle service lifecycle

**Intent Extras**:
- `EXTRA_SESSION_ID` (required): Session ID from backend
- `EXTRA_DEVICE_TOKEN` (optional): Device authentication token

**SharedPreferences**:
- `PREF_DEVICE_TOKEN`: Persisted device token

**Starting the Service**:
```kotlin
val intent = Intent(context, RemoteControlService::class.java).apply {
    putExtra(RemoteControlService.EXTRA_SESSION_ID, sessionId)
    putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
}

if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    startForegroundService(intent)
} else {
    startService(intent)
}
```

### DeviceUtils

**File**: `DeviceUtils.kt` (already implemented)

**Responsibility**:
- Provide unique device identifier
- Returns same ID as Capacitor's `Device.getId()` in main player

**Usage**:
```kotlin
val deviceId = DeviceUtils.getDeviceId(context)
```

## Backend Integration

### WebSocket Endpoint

**URL**: `wss://api.castmill.io/socket/websocket` (or configured backend URL)

### Channel Join

**Topic**: `device_rc:#{device_id}`

**Join Payload**:
```json
{
  "token": "device_authentication_token",
  "session_id": "rc_session_id_from_backend"
}
```

### Message Flow

1. **Device connects**: WebSocket opens to `/socket/websocket`
2. **Join channel**: Device sends join message with credentials
3. **Backend verifies**: Checks device token and session validity
4. **Join reply**: Backend confirms successful join
5. **Control events**: Backend sends control events to device
6. **Device events**: Device sends status/events to backend
7. **Heartbeat**: Device sends periodic heartbeat (30s)

### Event Types

**From Backend** (control events):
- `control_event`: Control commands for device
- `session_stopped`: Session terminated by backend
- `phx_reply`: Response to join/messages

**To Backend** (device events):
- `device_event`: Status updates from device
- `heartbeat`: Keep-alive ping

## Configuration

### Backend URL

**File**: `res/values/strings.xml`

```xml
<string name="backend_url">https://api.castmill.io</string>
```

To override for development:
1. Create `res/values-debug/strings.xml`
2. Set different backend URL for debug builds

### Permissions

**File**: `AndroidManifest.xml`

Required permissions:
- `INTERNET` - Network communication
- `FOREGROUND_SERVICE` - Run as foreground service
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` - Media projection type
- `POST_NOTIFICATIONS` - Show notifications (Android 13+)

## Testing

### Unit Tests

**File**: `RemoteControlServiceTest.kt`

Tests include:
- Service creation and lifecycle
- Notification channel creation
- Foreground notification posting
- Intent parameter handling
- Device ID computation
- Device token storage and retrieval
- Error handling

**Running Tests**:
```bash
cd android
./gradlew test
```

### Integration Testing

To test the full flow:

1. Configure backend URL in `strings.xml`
2. Obtain device token from backend
3. Create RC session via backend API
4. Start RemoteControlService with session ID and token
5. Verify WebSocket connection in logs
6. Send control event from backend
7. Verify device receives event

## Logging

All components use Android Log with tags:
- `WebSocketManager`: WebSocket connection and events
- `RemoteControlService`: Service lifecycle
- `MainActivity`: UI and permissions

Enable verbose logging:
```bash
adb logcat -s WebSocketManager:V RemoteControlService:V
```

## Security Considerations

1. **Device Token**: Stored in SharedPreferences (consider encrypting)
2. **WebSocket**: Uses WSS (TLS encryption) in production
3. **Authentication**: Token verified by backend on join
4. **Session Validation**: Backend validates session_id and device_id match

## Future Enhancements

1. **Media Projection**: Screen capture and encoding
2. **Error Handling**: More robust error recovery
3. **Metrics**: Connection quality and latency tracking
4. **Configuration UI**: Allow users to configure backend URL and credentials

## Gesture Support

The RemoteAccessibilityService provides comprehensive input injection capabilities including tap, long press, swipe, and multi-step gestures with automatic coordinate mapping from the remote control window to device screen.

See [GESTURE_SUPPORT.md](GESTURE_SUPPORT.md) for detailed documentation on:
- Gesture types and usage
- Coordinate mapping algorithm
- Handling display rotation and letterboxing
- WebSocket message formats
- Testing and troubleshooting

## Troubleshooting

### WebSocket Connection Fails

1. Check backend URL in `strings.xml`
2. Verify network connectivity
3. Check device token is valid
4. Verify session exists and is active
5. Check logs for error messages

### Service Stops Unexpectedly

1. Check battery optimization settings
2. Verify foreground notification is visible
3. Check for crashes in logs
4. Ensure device has sufficient resources

### Device ID Issues

1. Verify Settings.Secure.ANDROID_ID is accessible
2. Check device permissions
3. Compare with ID from main player app

## References

- Phoenix WebSocket Protocol: https://hexdocs.pm/phoenix/js/
- Android Foreground Services: https://developer.android.com/guide/components/foreground-services
- OkHttp WebSocket: https://square.github.io/okhttp/4.x/okhttp/okhttp3/-web-socket/
