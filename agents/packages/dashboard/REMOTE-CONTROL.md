# Dashboard Device Remote Control Feature

## Overview

The Device Remote Control feature allows administrators to remotely view and control digital signage devices through the Dashboard interface. This document describes the implementation of the Remote Control tab in the Device Details view.

## Feature Components

### RemoteControl Component

**Location**: `packages/castmill/lib/castmill/addons/devices/components/remote-control.tsx`

The RemoteControl component provides a user interface for starting and configuring remote control sessions with devices.

#### Key Features

1. **Device Status Display**
   - Shows online/offline status with visual indicator
   - Displays last check-in time
   - Shows active session status

2. **Session Configuration**
   - Resolution selector (Auto, 480p, 720p)
   - FPS selector (Auto, 10, 15, 30)
   - Start session button

3. **Session Management**
   - Calls `POST /devices/{id}/rc/sessions` API endpoint
   - Opens remote control interface in popup window
   - URL format: `/org/:orgId/devices/:id/remote-control?session={sessionId}`

#### Props Interface

```typescript
interface RemoteControlProps {
  baseUrl: string;           // API base URL
  device: Device;            // Device object with status info
  organizationId: string;    // Organization context for URL routing
  t?: (key: string, params?: Record<string, any>) => string; // i18n function
}
```

### DevicesService API

**Location**: `packages/castmill/lib/castmill/addons/devices/services/devices.service.ts`

#### New Method: `startRemoteControlSession`

```typescript
async startRemoteControlSession(
  baseUrl: string,
  deviceId: string,
  resolution: string,  // 'auto', '480p', or '720p'
  fps: number          // 0 for auto, or 10, 15, 30
): Promise<{ session_id: string; url: string }>
```

Makes a POST request to `/dashboard/devices/{deviceId}/rc/sessions` with resolution and FPS configuration.

### Device View Integration

**Location**: `packages/castmill/lib/castmill/addons/devices/components/device-view.tsx`

The Remote Control tab is added to the device details tabs array, positioned after the Channels tab and before the Preview tab. This provides quick access to remote control functionality.

### RemoteControlWindow Component

**Location**: `packages/dashboard/src/pages/remote-control-window/remote-control-window.tsx`

The RemoteControlWindow component provides a fullscreen interface for active remote control sessions. It is opened in a popup window when a user starts a remote control session from the RemoteControl component.

#### Key Features

1. **WebSocket Connection**
   - Connects to Phoenix channel: `rc:{sessionId}`
   - Joins channel with device_id parameter
   - Handles connection states: connecting, connected, disconnected, error
   - Automatic cleanup on component unmount

2. **Video Stream Display**
   - HTML5 canvas element for rendering device screen
   - Receives frames via WebSocket as base64-encoded JPEG images
   - Auto-resizes canvas to match frame dimensions
   - Fullscreen display with centered canvas

3. **Input Handling**
   - **Keyboard Events**: Captures keydown/keyup with modifiers (shift, ctrl, alt, meta)
   - **Mouse Events**: Captures click, mousedown, mouseup, mousemove
   - Coordinates scaled to device resolution
   - Events sent through WebSocket to device

4. **Status Indicators**
   - Visual connection status (connecting/connected/disconnected/error)
   - Animated status indicator with color coding
   - Device ID display in header
   - Error messages with hints for recovery

#### Component Architecture

```typescript
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// State Management
const [connectionState, setConnectionState] = createSignal<ConnectionState>('connecting');
const [channel, setChannel] = createSignal<any>(null);
const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(null);
const [ctx, setCtx] = createSignal<CanvasRenderingContext2D | null>(null);

// WebSocket Events Handled
- 'frame': Receives and renders video frames
- 'status': Updates connection status
- 'input': Sends keyboard/mouse events to device
```

#### Styling

**Location**: `packages/dashboard/src/pages/remote-control-window/remote-control-window.scss`

- Fullscreen dark theme optimized for viewing device screens
- Status indicators with color-coded animations
- Responsive canvas scaling
- Professional error states

## Internationalization (i18n)

All user-facing text is localized using the i18n system with support for 9 languages:
- English (en)
- Spanish (es)
- Swedish (sv)
- German (de)
- French (fr)
- Chinese (zh)
- Arabic (ar) - RTL support
- Korean (ko)
- Japanese (ja)

### Translation Keys

Located in `packages/dashboard/src/i18n/locales/{lang}.json`:

```json
{
  "devices": {
    "remoteControl": {
      "title": "Remote Control",
      "status": "Status",
      "online": "Online",
      "offline": "Offline",
      "lastCheckIn": "Last Check-In",
      "activeSession": "Active Session",
      "now": "Now",
      "sessionSettings": "Session Settings",
      "resolution": "Resolution",
      "fps": "FPS",
      "auto": "Auto",
      "startSession": "Start RC Session",
      "sessionStarted": "Remote control session started",
      "sessionStartError": "Failed to start remote control session: {{error}}",
      "deviceOfflineError": "Cannot start session - device is offline",
      "window": {
        "connecting": "Connecting",
        "connected": "Connected",
        "disconnected": "Disconnected",
        "error": "Error",
        "device": "Device",
        "connectingMessage": "Connecting to device...",
        "deviceDisconnected": "Device has been disconnected",
        "errorHint": "Please close this window and try starting a new session",
        "missingParams": "Missing session or device parameters",
        "connectionError": "Connection error: {{error}}",
        "connectionTimeout": "Connection timeout - please try again"
      }
    }
  },
  "common": {
    "no": "No"
  }
}
```

## URL-Based Routing

The feature properly maintains organization context in URLs following the pattern:
- Session popup URL: `/org/:orgId/devices/:id/remote-control?session={sessionId}`
- This ensures proper state management and organization isolation

## Testing

### Unit Tests

**Location**: 
- `packages/castmill/lib/castmill/addons/devices/components/remote-control.test.tsx`
- `packages/castmill/lib/castmill/addons/devices/services/devices.service.test.ts`
- `packages/dashboard/src/pages/remote-control-window/remote-control-window.test.tsx`

#### Test Coverage - RemoteControl Component

1. **Component Rendering**
   - Status section for online/offline devices
   - Session settings section with selectors
   - Correct button states based on device status

2. **User Interactions**
   - Resolution selector changes
   - FPS selector changes
   - Start session button behavior

3. **Session Management**
   - API call with correct parameters
   - Popup window opening with correct URL
   - Error handling for failed sessions

4. **Service Methods**
   - Successful session creation
   - Auto resolution and FPS handling
   - Error handling for offline devices
   - Network error handling

#### Test Coverage - RemoteControlWindow Component

**Location**: `packages/dashboard/src/pages/remote-control-window/remote-control-window.test.tsx`

1. **Basic Rendering** (3 tests)
   - Component renders correctly
   - Device ID displayed in header
   - Shows connecting status initially

2. **WebSocket Connection** (3 tests)
   - Joins RC channel with correct parameters
   - Displays connected status after successful join
   - Leaves channel on cleanup

3. **Video Frame Display** (3 tests)
   - Renders canvas element when connected
   - Sets up frame listener on channel
   - Sets up status listener on channel

4. **Input Handling** (3 tests)
   - Sends keyboard input when keys are pressed
   - Sends mouse click input when canvas is clicked
   - Sends mouse move input when mouse moves over canvas

### Running Tests

```bash
# Run all dashboard tests
cd packages/dashboard
yarn test --run

# Run specific test file
yarn test remote-control-window.test.tsx --run

# Run device addon tests
cd packages/castmill
yarn test devices
```

## Backend Requirements

The feature requires the backend to implement:

1. **POST /dashboard/devices/{id}/rc/sessions**
   - Request body: `{ resolution: string, fps: number }`
   - Response: `{ session_id: string, url: string }`
   - Authorization: User must have device access

2. **WebSocket endpoint** for real-time remote control streaming
   - Phoenix Channel: `rc:{sessionId}`
   - Join parameters: `{ device_id: string }`

### WebSocket Protocol

#### Messages from Server to Client

1. **frame** - Video frame data
   ```json
   {
     "data": "base64-encoded-jpeg-image"
   }
   ```

2. **status** - Connection status updates
   ```json
   {
     "status": "disconnected" | "connected"
   }
   ```

#### Messages from Client to Server

**input** - User input events
```json
// Keyboard events
{
  "type": "keydown" | "keyup",
  "key": "Enter",
  "code": "Enter",
  "shift": false,
  "ctrl": false,
  "alt": false,
  "meta": false
}

// Mouse events
{
  "type": "click" | "mousedown" | "mouseup",
  "x": 100,
  "y": 200,
  "button": 0
}

// Mouse move events
{
  "type": "mousemove",
  "x": 50,
  "y": 75
}
```

## Security Considerations

1. **Authorization**: Session creation requires proper device access permissions
2. **Organization Context**: URLs embed organization ID for proper isolation
3. **Session Validation**: Backend validates device is online before creating session
4. **CORS**: Dashboard must be configured to allow popup window communication

## User Experience

### For Online Devices
1. User navigates to Device Details
2. Clicks on "Remote Control" tab
3. Optionally adjusts resolution and FPS settings
4. Clicks "Start RC Session" button
5. Popup window opens with live device view
6. User can interact with remote device

### For Offline Devices
- "Start RC Session" button is disabled
- Status clearly shows "Offline" with red indicator
- Displays last check-in timestamp
- User cannot start a session until device comes online

## Future Enhancements

Potential improvements for the remote control feature:

1. **Session History**: Track and display previous remote control sessions
2. **Active Session Indicator**: Real-time display of current active sessions
3. **Multi-Monitor Support**: Handle devices with multiple displays
4. **Recording**: Option to record remote control sessions
5. **Permission Levels**: Different levels of control (view-only, full control)
6. **Session Sharing**: Allow multiple users to view the same session
7. **Bandwidth Management**: Dynamic quality adjustment based on connection

## Architecture Decisions

### Component Placement
- Located in devices addon for clear feature ownership
- Integrated into existing device-view tab system
- Follows existing patterns for device management features

### State Management
- Uses SolidJS signals for reactive UI state
- Minimal state - only resolution, FPS, and loading indicators
- Device status comes from props, not internal state

### Error Handling
- Toast notifications for user feedback
- Graceful degradation for offline devices
- Clear error messages with i18n support

### Popup Window vs Embedded View
- Popup chosen for:
  - Full-screen remote control experience
  - Separates remote control from main dashboard navigation
  - Easier to position and resize independently
  - Common pattern for similar features

## Troubleshooting

### Session won't start
- Check device is online
- Verify user has proper permissions
- Check backend WebSocket configuration
- Verify network connectivity to device

### Popup blocked
- Browser may block popup - user needs to allow popups for the domain
- Check popup blocker settings

### Connection issues
- Verify WebSocket endpoint is accessible
- Check firewall rules for WebSocket traffic
- Ensure proper CORS configuration

## References

- Device Interface: `packages/castmill/lib/castmill/addons/devices/interfaces/device.interface.ts`
- DevicesService: `packages/castmill/lib/castmill/addons/devices/services/devices.service.ts`
- i18n System: `packages/dashboard/src/i18n/`
- Dashboard AGENTS.md: `packages/dashboard/AGENTS.md`
