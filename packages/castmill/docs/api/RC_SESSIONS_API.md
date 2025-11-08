# Remote Control Sessions API

This document describes the REST API and WebSocket endpoints for remote control sessions between devices and the dashboard.

## Overview

The Remote Control (RC) Sessions API enables real-time remote control of devices from the dashboard. It consists of:
- REST endpoints for session management
- WebSocket channels for real-time communication and media streaming

## REST Endpoints

### Create RC Session

Creates a new remote control session for a device.

**Endpoint:** `POST /dashboard/devices/:device_id/rc/sessions`

**Authentication:** Required (Bearer token)

**Parameters:**
- `device_id` (path) - UUID of the device

**Response (201 Created):**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "660e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "started_at": "2025-11-05T21:00:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Device not found
- `409 Conflict` - Device already has an active RC session
- `401 Unauthorized` - Authentication required

---

### Stop RC Session

Stops an active remote control session.

**Endpoint:** `POST /dashboard/rc/sessions/:session_id/stop`

**Authentication:** Required (Bearer token)

**Parameters:**
- `session_id` (path) - UUID of the session

**Response (200 OK):**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "stopped",
  "stopped_at": "2025-11-05T21:30:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Session not found
- `403 Forbidden` - User doesn't own the session
- `401 Unauthorized` - Authentication required

---

### Get Device RC Status

Gets the current remote control status for a device.

**Endpoint:** `GET /dashboard/devices/:device_id/rc/status`

**Authentication:** Required (Bearer token)

**Parameters:**
- `device_id` (path) - UUID of the device

**Response (200 OK) - With Active Session:**
```json
{
  "has_active_session": true,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "770e8400-e29b-41d4-a716-446655440000",
  "started_at": "2025-11-05T21:00:00Z"
}
```

**Response (200 OK) - No Active Session:**
```json
{
  "has_active_session": false
}
```

**Error Responses:**
- `404 Not Found` - Device not found

## WebSocket Endpoints

All WebSocket endpoints use the `/ws` socket path.

### Device RC Channel

Handles the device side of remote control communication.

**Topic:** `device_rc:{device_id}`

**Connection Parameters:**
```javascript
{
  "token": "device_token",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Messages to Device:**
- `control_event` - Control event from RC window (clicks, touches, etc.)
- `session_stopped` - Session has been stopped

**Messages from Device:**
- `device_event` - Events from device (screen updates, state changes)

**Example:**
```javascript
// Connect device
const socket = new Socket("/ws")
socket.connect()

const channel = socket.channel("device_rc:device123", {
  token: "device_token_here",
  session_id: "session_id_here"
})

// Listen for control events
channel.on("control_event", (payload) => {
  console.log("Control event:", payload)
  // Handle click, touch, etc.
})

// Send device events
channel.push("device_event", {
  type: "screen_update",
  data: {...}
})

channel.join()
```

---

### Device Media Channel

Handles media streaming from device to dashboard.

**Topic:** `device_media:{device_id}:{session_id}`

**Connection Parameters:**
```javascript
{
  "token": "device_token"
}
```

**Messages from Device:**
- `media_frame` - Video/screen capture frame
- `media_metadata` - Stream metadata (resolution, fps, etc.)

**Messages to Device:**
- `session_stopped` - Session has been stopped

**Example:**
```javascript
// Connect device media stream
const channel = socket.channel("device_media:device123:session456", {
  token: "device_token_here"
})

// Send media frames
channel.push("media_frame", {
  data: base64_encoded_frame,
  timestamp: Date.now()
})

// Send metadata
channel.push("media_metadata", {
  resolution: "1920x1080",
  fps: 30
})

channel.join()
```

---

### RC Window Channel

Handles the dashboard side of remote control.

**Topic:** `rc_window:{session_id}`

**Connection Parameters:**
Requires authenticated user connection (user_id in socket params)

**Messages to RC Window:**
- `device_connected` - Device connected to session
- `device_disconnected` - Device disconnected
- `device_event` - Event from device
- `media_stream_ready` - Media stream is ready
- `media_stream_disconnected` - Media stream disconnected
- `media_frame` - Video/screen capture frame
- `media_metadata` - Stream metadata

**Messages from RC Window:**
- `control_event` - Control event to send to device
- `request_metadata` - Request updated metadata from device

**Example:**
```javascript
// Connect RC window (dashboard)
const socket = new Socket("/ws", {
  params: { user_id: "user_id_here" }
})
socket.connect()

const channel = socket.channel("rc_window:session456", {})

// Listen for device events
channel.on("device_connected", (payload) => {
  console.log("Device connected:", payload.device_id)
})

channel.on("media_frame", (payload) => {
  // Display frame in UI
  displayFrame(payload.data)
})

// Send control event
channel.push("control_event", {
  action: "click",
  x: 100,
  y: 200
})

channel.join()
```

## Session Lifecycle

1. **Create Session:** Dashboard user creates RC session via REST API
2. **Device Connect:** Device connects to `device_rc` and `device_media` channels
3. **RC Window Connect:** Dashboard user connects to `rc_window` channel
4. **Active Session:** Real-time communication and media streaming
5. **Stop Session:** User stops session via REST API or closes connection
6. **Cleanup:** All channels disconnect, session marked as stopped

## Security

- Device connections require valid device token
- RC window connections require authenticated user
- Session ownership verified for stop operations
- Only one active session per device at a time

## PubSub Architecture

The implementation uses Phoenix PubSub for communication between channels:
- Topic: `rc_session:{session_id}`
- Device channels publish events to this topic
- RC window channel subscribes to receive all events
- Enables loose coupling between device and dashboard connections
