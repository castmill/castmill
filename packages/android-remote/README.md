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
3. **WebSocketManager**: WebSocket client implementation
   - Connects to backend using Phoenix protocol
   - Handles automatic reconnection with exponential backoff
   - Routes control events and device events
   - Maintains heartbeat to keep connection alive
4. **RemoteAccessibilityService**: Accessibility service for input injection
   - Injects touch events and gestures
   - Performs global actions (back, home, recents)
   - Enables remote control of the device UI
5. **DeviceUtils**: Device identification utilities
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

1. Enable "Unknown Sources" or "Install from Unknown Sources" in device settings
2. Install the APK on the target Android device
3. Grant MediaProjection permission when prompted
4. Enable the AccessibilityService in Android settings:
   - Settings → Accessibility → Castmill Remote Control → Enable

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
<string name="backend_url">https://api.castmill.com</string>
```

For development, create `res/values-debug/strings.xml` with a different URL.

### WebSocket Protocol

The service uses the Phoenix WebSocket protocol to communicate with the backend:

- **Endpoint**: `wss://api.castmill.com/socket/websocket`
- **Channel**: `device_rc:#{device_id}`
- **Auth**: Token and session ID sent on join
- **Heartbeat**: Every 30 seconds
- **Reconnect**: Automatic with exponential backoff (1s to 60s)

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for detailed documentation.

### Security Considerations

- The service requires sensitive permissions (screen capture, accessibility)
- Should only be installed on managed devices in controlled environments
- WebSocket connections should be secured with authentication tokens
- Network traffic should be encrypted (WSS protocol)

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
