# Castmill Android Remote Control

## Overview

The Castmill Android Remote Control service enables remote control and monitoring of Android devices running the Castmill digital signage player. This companion app provides essential remote management capabilities for devices deployed in the field.

## Purpose

This service enables:

- **Remote Screen Capture**: Stream the device screen in real-time using MediaProjection and MediaCodec
- **Remote Input Control**: Inject touch events, swipes, and key presses via AccessibilityService
- **Remote Monitoring**: WebSocket-based communication for bidirectional control
- **Device Management**: Enable remote troubleshooting and configuration of digital signage displays

## Technical Architecture

### Core Components

1. **MainActivity**: Entry point and permission management
   - Handles MediaProjection permissions
   - Guides users through AccessibilityService setup
2. **RemoteControlService**: Foreground service for remote control
   - Maintains WebSocket connection to backend
   - Manages device identification and authentication
   - Runs as compliant Android 10+ foreground service
   - Shows persistent notification with connection status
   - Coordinates screen capture and encoding
3. **WebSocketManager**: WebSocket client implementation
   - Connects to backend using Phoenix protocol
   - Handles automatic reconnection with exponential backoff
   - Routes control events and device events
   - Maintains heartbeat to keep connection alive
   - Transmits video frames as binary WebSocket messages
4. **ScreenCaptureManager**: Screen capture orchestration
   - Creates VirtualDisplay from MediaProjection
   - Manages video encoder lifecycle
   - Implements automatic H.264 → MJPEG fallback
5. **VideoEncoder**: H.264/AVC video encoding
   - Encodes at 720p, 10-15 fps, 1.5-3 Mbps CBR
   - Uses MediaCodec with hardware acceleration
   - Outputs NAL units for WebSocket transmission
6. **MjpegEncoder**: MJPEG fallback encoding
   - Encodes JPEG frames at lower fps (5 fps)
   - Software-based fallback when H.264 unavailable
7. **RemoteAccessibilityService**: Accessibility service for input injection
   - Injects touch events and gestures
   - Performs global actions (back, home, recents)
   - Enables remote control of the device UI
8. **DeviceUtils**: Device identification utilities
   - Returns unique device identifier (same as main player)
   - Uses Settings.Secure.ANDROID_ID for consistency

### Dependencies

- **androidx.lifecycle**: Lifecycle-aware components for service management
- **okhttp3**: WebSocket client for real-time communication
- **kotlinx.serialization**: JSON serialization for control messages
- **MediaProjection**: Android SDK API for screen capture (API 26+)
- **MediaCodec**: Android SDK API for video encoding
- **AccessibilityService**: Android SDK API for input injection

## Requirements

- **Minimum SDK**: API 26 (Android 8.0 Oreo)
- **Target SDK**: API 34 (Android 14)
- **Application ID**: `com.castmill.androidremote`

### Required Permissions

The app requires two critical permissions for full functionality:

1. **AccessibilityService** - For remote gesture injection
   - Allows remote control of touch events (tap, swipe, etc.)
   - Must be manually enabled by user in Settings
   - See [Quick Start Guide](QUICK_START_PERMISSIONS.md) for setup instructions

2. **MediaProjection** - For screen capture
   - Allows remote viewing of device screen
   - User must grant permission for each session (manual consent)
   - Can be auto-granted via Device Owner policy (managed devices)
   - See [Device Owner Setup](PERMISSIONS.md#track-2-device-owner-auto-grant-managed-device-deployment)

Both permissions involve sensitive capabilities and require explicit user consent or enterprise device management policies.

**📖 Documentation:**
- **[Quick Start Guide](QUICK_START_PERMISSIONS.md)** - Step-by-step setup instructions
- **[PERMISSIONS.md](PERMISSIONS.md)** - Complete permission documentation, consent flows, and Device Owner setup

## Building

Build the Android app using Gradle:

```bash
cd android
./gradlew build
```

To build a debug APK:

```bash
./gradlew assembleDebug
```

To build a release APK:

```bash
./gradlew assembleRelease
```

## Installation

### Prerequisites

Before installing the app, ensure:

1. Android device running API 26+ (Android 8.0 Oreo or later)
2. Device is either:
   - Personally owned with user present to grant permissions, OR
   - Managed device with Device Owner policy configured (see [PERMISSIONS.md](PERMISSIONS.md))

### Installation Steps

1. **Enable "Install unknown apps" (Android 8.0+) or "Unknown sources" (earlier versions)**
   - For Android 8.0 (Oreo, API 26) and above: Go to Settings → Apps & notifications → Special app access → Install unknown apps, then enable for the browser or file manager you'll use to install
   - For Android 7.x and below: Go to Settings → Security → Unknown sources, then enable
   - On Android 8.0+, permission is granted per-app

2. **Install the APK**
   - Transfer the APK to the device
   - Open the APK file
   - Tap "Install"
   - Wait for installation to complete

3. **Grant Required Permissions**
   
   **A. Enable AccessibilityService** (Required for gesture control):
   - Open the Castmill Remote app
   - Tap "Enable Accessibility Service"
   - Follow on-screen instructions
   - In Android Settings → Accessibility:
     - Find "Castmill Remote" in the list
     - Toggle the switch to ON
     - Accept the system warning dialog
   - Return to the app to verify "Enabled" status

   **B. Grant MediaProjection Permission** (Required for screen capture):
   - In the Castmill Remote app
   - Tap "Grant Screen Capture"
   - Read the explanation dialog
   - Tap "I Understand"
   - When system dialog appears, tap "Start now"
   - Permission is granted for the current session
   
   **Note**: MediaProjection must be re-granted each time the app restarts or a new remote session begins. This is an Android security requirement. For managed devices, see [Device Owner Auto-Grant](PERMISSIONS.md#track-2-device-owner-auto-grant-managed-device-deployment) to bypass this requirement.

4. **Verify Setup**
   - Both permission cards should show green "Enabled" or "Granted" status
   - Device ID is displayed for backend configuration

### Post-Installation

- The app displays your unique Device ID - note this for backend configuration
- Service status shows "Remote control service is not running" until a session is initiated
- When a remote session is requested (from backend), the RemoteControlService starts automatically
- A persistent notification appears when the service is active

For troubleshooting permission issues, see [PERMISSIONS.md](PERMISSIONS.md#troubleshooting).

## Usage

This service is designed to run on Android devices alongside the Castmill digital signage player. It provides remote access capabilities for device management and troubleshooting.

### Starting the Service

The RemoteControlService can be started with the following parameters:

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

**Required Parameters**:
- `EXTRA_SESSION_ID`: RC session ID from backend
- `EXTRA_DEVICE_TOKEN`: Device authentication token (persisted after first use)

The service will:
1. Compute the device ID using `DeviceUtils.getDeviceId()`
2. Connect to the backend WebSocket at `device_rc:#{device_id}`
3. Authenticate with the provided token and session ID
4. Show a persistent notification indicating connection status
5. Automatically reconnect if connection is lost

### Backend Configuration

The backend URL is configured in `res/values/strings.xml`:

```xml
<string name="backend_url">https://api.castmill.io</string>
```

For development, create `res/values-debug/strings.xml` with a different URL.

### WebSocket Protocol

The service uses the Phoenix WebSocket protocol to communicate with the backend:

- **Endpoint**: `wss://api.castmill.io/socket/websocket`
- **Channel**: `device_rc:#{device_id}`
- **Auth**: Token and session ID sent on join
- **Heartbeat**: Every 30 seconds
- **Reconnect**: Automatic with exponential backoff (1s to 60s)
- **Video Frames**: Binary WebSocket messages with metadata + NAL units

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for detailed documentation.

### Video Capture and Encoding

The service supports real-time screen capture and video encoding:

- **Primary Codec**: H.264/AVC (baseline, level 3.1)
  - 720p resolution (1280x720)
  - 10-15 fps frame rate
  - 1.5-3 Mbps CBR bitrate
  - ~2 second keyframe interval
- **Fallback Codec**: MJPEG (Motion JPEG)
  - 720p resolution
  - 5 fps frame rate (reduced for bandwidth)
  - JPEG quality 75
- **Automatic Fallback**: H.264 → MJPEG if encoding fails
- **Transmission**: NAL units via WebSocket binary frames

See [VIDEO_CAPTURE_IMPLEMENTATION.md](VIDEO_CAPTURE_IMPLEMENTATION.md) for complete video capture documentation.

### Security Considerations

- The service requires sensitive permissions (screen capture, accessibility)
- Should only be installed on managed devices in controlled environments
- WebSocket connections should be secured with authentication tokens
- Network traffic should be encrypted (WSS protocol)
- See [PERMISSIONS.md](PERMISSIONS.md#security-considerations) for detailed security information

### Permission and Consent Flows

The app implements two permission tracks:

**Track 1: Manual Consent Flow (Standard Deployment)**
- User must manually grant MediaProjection permission for each session
- AccessibilityService must be manually enabled in Settings
- Suitable for most deployments
- Clear UI guidance helps users through the process
- See [PERMISSIONS.md - Track 1](PERMISSIONS.md#track-1-manual-consent-flow-mvp---current-implementation)

**Track 2: Device Owner Auto-Grant (Managed Device Deployment)**  
- MediaProjection permission can be auto-granted via Device Owner policy
- Suitable for fully managed corporate devices (kiosk mode, digital signage)
- Requires device enrollment in MDM (Mobile Device Management)
- AccessibilityService still requires manual enable (Android restriction)
- See [PERMISSIONS.md - Track 2](PERMISSIONS.md#track-2-device-owner-auto-grant-managed-device-deployment)

For complete documentation on permissions, consent flows, and enterprise deployment, see **[PERMISSIONS.md](PERMISSIONS.md)**.

## Device Identification

### DeviceUtils

The `DeviceUtils` class provides device-specific utility functions, including unique device identification.

#### getDeviceId()

Returns the unique device identifier, identical to what Capacitor's `Device.getId()` returns in the main Android player application.

**Original Implementation Source:**
- **Capacitor Device Plugin**: `@capacitor/device` npm package (version 6.0.1+)
- **Used in Main Player**: `packages/platforms/android-player/src/ts/classes/android-machine.ts`
  - Method: `getMachineGUID()` calls `Device.getId()`
  - Returns: `deviceId.identifier`

**Implementation Details:**
- Uses `Settings.Secure.ANDROID_ID` for device identification
- Returns a 64-bit number as a hexadecimal string
- Remains constant for the lifetime of the device's operating system
- Resets only on factory reset
- Returns empty string if unavailable or on error

**Location in this workspace:**
- **Implementation**: `packages/android-remote/android/app/src/main/java/com/castmill/androidremote/DeviceUtils.kt`
- **Tests**: `packages/android-remote/android/app/src/test/java/com/castmill/androidremote/DeviceUtilsTest.kt`

**Usage Example:**
```kotlin
val deviceId = DeviceUtils.getDeviceId(context)
// Returns: "1234567890abcdef" (16-character hex string)
```

**Testing:**
Run the unit tests to verify the implementation:
```bash
cd android
./gradlew test
```

## Development

The project is structured as a Yarn workspace within the Castmill monorepo:

```
packages/platforms/android-remote/
├── android/              # Android Gradle project
│   ├── app/             # Application module
│   │   ├── src/main/    # Kotlin source code
│   │   │   ├── java/com/castmill/androidremote/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── RemoteControlService.kt     # Foreground service with WebSocket
│   │   │   │   ├── WebSocketManager.kt         # Phoenix WebSocket client
│   │   │   │   ├── RemoteAccessibilityService.kt
│   │   │   │   └── DeviceUtils.kt              # Device identification utilities
│   │   │   ├── res/     # Android resources
│   │   │   └── AndroidManifest.xml
│   │   ├── src/test/    # Unit tests
│   │   │   └── java/com/castmill/androidremote/
│   │   │       ├── DeviceUtilsTest.kt          # DeviceUtils tests
│   │   │       └── RemoteControlServiceTest.kt  # Service tests
│   │   └── build.gradle
│   ├── build.gradle     # Root build configuration
│   ├── settings.gradle
│   └── variables.gradle # Version configuration
├── IMPLEMENTATION.md    # Detailed implementation documentation
├── package.json
└── README.md
```

## License

AGPL-3.0-or-later

Copyright (c) Castmill AB
