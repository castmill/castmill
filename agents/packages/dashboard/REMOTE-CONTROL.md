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
      "deviceOfflineError": "Cannot start session - device is offline"
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

#### Test Coverage

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

### Running Tests

```bash
cd packages/castmill
# Run all device addon tests
yarn test devices

# Run specific test file
yarn test remote-control.test.tsx
```

## Backend Requirements

The feature requires the backend to implement:

1. **POST /dashboard/devices/{id}/rc/sessions**
   - Request body: `{ resolution: string, fps: number }`
   - Response: `{ session_id: string, url: string }`
   - Authorization: User must have device access

2. **WebSocket endpoint** for real-time remote control streaming
   - Connection URL provided in session creation response

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
