# Session Lifecycle Sequence Diagram

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌─────────────┐
│  Dashboard  │    │   Backend   │    │WebSocketMgr  │    │RemoteControlSvc│    │ScreenCapture│
│  RC Window  │    │   Server    │    │ (device_rc)  │    │                │    │   Manager   │
└──────┬──────┘    └──────┬──────┘    └──────┬───────┘    └───────┬────────┘    └──────┬──────┘
       │                  │                   │                    │                    │
       │  1. Create RC    │                   │                    │                    │
       │    Session       │                   │                    │                    │
       ├─────────────────>│                   │                    │                    │
       │                  │                   │                    │                    │
       │  2. Push/Notify  │                   │                    │                    │
       │    Device        │                   │                    │                    │
       │                  ├──────────────────>│                    │                    │
       │                  │                   │                    │                    │
       │                  │                   │  3. Start Service  │                    │
       │                  │                   │      (sessionId)   │                    │
       │                  │                   ├───────────────────>│                    │
       │                  │                   │                    │                    │
       │                  │  4. Connect to    │                    │                    │
       │                  │     device_rc     │                    │                    │
       │                  │<──────────────────┼────────────────────┤                    │
       │                  │                   │                    │                    │
       │                  │  5. send:         │                    │                    │
       │                  │     start_session │                    │                    │
       │                  ├──────────────────>│                    │                    │
       │                  │                   │                    │                    │
       │                  │                   │  6. onStartSession │                    │
       │                  │                   │      callback      │                    │
       │                  │                   ├───────────────────>│                    │
       │                  │                   │                    │                    │
       │                  │                   │                    │  7. Check          │
       │                  │                   │                    │    MediaProjection │
       │                  │                   │                    │    Permission      │
       │                  │                   │                    │                    │
       │                  │                   │                    │  8. Initialize     │
       │                  │                   │                    │    MediaWebSocket  │
       │                  │                   │                    │                    │
       │                  │  9. Connect to    │                    │                    │
       │                  │     device_media  │◄───────────────────┤                    │
       │                  │     :device:session                    │                    │
       │                  │                   │                    │                    │
       │                  │                   │                    │ 10. Start Encoder  │
       │                  │                   │                    ├───────────────────>│
       │                  │                   │                    │                    │
       │                  │                   │                    │                    │
       │                  │ 11. Video Frames  │                    │ 12. onFrameEncoded │
       │                  │     (binary WS)   │◄────────────────────────────────────────┤
       │                  │◄──────────────────┤                    │                    │
       │                  │                   │                    │                    │
       │ 13. Display      │                   │                    │                    │
       │     Video        │                   │                    │                    │
       │◄─────────────────┤                   │                    │                    │
       │                  │                   │                    │                    │
```

## Key Components

### 1. WebSocketManager (Control Channel)
- **Channel**: `device_rc:#{device_id}`
- **Purpose**: Bidirectional control communication
- **Events**: control_event, start_session, session_stopped, device_event
- **New Feature**: `onStartSession` callback triggers media initialization

### 2. MediaWebSocketManager (Media Channel)
- **Channel**: `device_media:#{device_id}:#{session_id}`
- **Purpose**: Unidirectional video streaming
- **Messages**: Binary video frames with metadata
- **Independence**: Separate connection from control channel

### 3. RemoteControlService (Coordinator)
- **Role**: Orchestrates control and media WebSockets
- **State**: Tracks sessionId and pendingSessionId
- **Lifecycle**: Manages encoder startup and teardown
- **Integration**: Connects WebSocketManager to ScreenCaptureManager

### 4. ScreenCaptureManager (Encoder)
- **Encoding**: H.264 hardware or MJPEG software fallback
- **Output**: Video frames via onFrameEncoded callback
- **Destination**: MediaWebSocketManager for transmission

## Data Flow

### Control Messages
```
RC Window → Backend → PubSub → device_rc channel → WebSocketManager → RemoteControlService
```

### Media Frames
```
ScreenCaptureManager → MediaWebSocketManager → device_media channel → Backend → PubSub → RC Window
```

## Binary Frame Format

```
┌──────────────────┬─────────────────────────────────┬───────────────┐
│ Metadata Length  │      Metadata JSON              │  Video Data   │
│    (4 bytes)     │  (variable, UTF-8 encoded)      │   (variable)  │
└──────────────────┴─────────────────────────────────┴───────────────┘

Metadata JSON Example:
{
  "type": "video_frame",
  "codec": "h264",
  "is_key_frame": true,
  "timestamp": 1699968518123,
  "size": 45678
}
```

## Channel Topics

### Control Channel Topic
```
device_rc:#{device_id}

Example: device_rc:550e8400-e29b-41d4-a716-446655440000
```

### Media Channel Topic
```
device_media:#{device_id}:#{session_id}

Example: device_media:550e8400-e29b-41d4-a716-446655440000:rc_session_123456789
```

## Phoenix Protocol Messages

### Join Message
```json
[join_ref, ref, topic, "phx_join", payload]

Example Control:
["1", "1", "device_rc:device_123", "phx_join", {"token": "abc", "session_id": "xyz"}]

Example Media:
["1", "1", "device_media:device_123:session_xyz", "phx_join", {"token": "abc"}]
```

### Start Session Event
```json
[null, null, "device_rc:device_123", "start_session", {}]
```

### Binary Frame (WebSocket Binary)
```
[4-byte length][JSON metadata][NAL unit data]
```

## State Transitions

```
┌─────────────┐
│   Created   │  Service created
└─────┬───────┘
      │
      │ connect()
      ▼
┌─────────────┐
│  Connecting │  WebSocket connecting
└─────┬───────┘
      │
      │ onOpen + phx_join
      ▼
┌─────────────┐
│  Connected  │  device_rc channel joined
└─────┬───────┘
      │
      │ start_session event
      ▼
┌─────────────┐
│   Starting  │  Initializing media capture
└─────┬───────┘
      │
      │ Media WS connected + Encoder started
      ▼
┌─────────────┐
│  Streaming  │  Active media streaming
└─────┬───────┘
      │
      │ session_stopped or disconnect()
      ▼
┌─────────────┐
│   Stopped   │  Service destroyed
└─────────────┘
```
