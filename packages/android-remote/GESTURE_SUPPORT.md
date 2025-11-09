# Gesture Support and Input Injection

This document describes the gesture execution and input injection capabilities of the Castmill Android Remote Control service.

## Overview

The RemoteAccessibilityService provides comprehensive input injection capabilities using Android's AccessibilityService framework. This enables remote control of the device through:

- **Tap gestures**: Single touch at a point
- **Long press gestures**: Extended touch for context menus
- **Swipe gestures**: Linear movement between two points
- **Multi-step gestures**: Complex paths through multiple points
- **Global actions**: System-level actions (back, home, recents, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  WebSocketManager                        │
│  - Receives control_event messages from backend         │
│  - Parses gesture commands                              │
│  - Forwards to RemoteAccessibilityService               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│           RemoteAccessibilityService                     │
│  - Manages GestureMapper for coordinate transformation  │
│  - Builds GestureDescription objects                    │
│  - Dispatches gestures via dispatchGesture()            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                 GestureMapper                            │
│  - Maps RC window coordinates to device coordinates     │
│  - Handles display rotation                             │
│  - Accounts for letterboxing/pillarboxing               │
└─────────────────────────────────────────────────────────┘
```

## Coordinate Mapping

### Problem Statement

The remote control (RC) window and the physical device may have:
- Different resolutions (e.g., RC: 1280x720, Device: 1920x1080)
- Different aspect ratios (e.g., RC: 16:9, Device: 4:3)
- Different orientations (e.g., RC: landscape, Device: portrait)

To accurately inject touch events, RC coordinates must be transformed to device coordinates.

### Mapping Algorithm

The `GestureMapper` class implements the following algorithm:

#### 1. Aspect Ratio Calculation

```
rcAspect = rcWidth / rcHeight
deviceAspect = deviceWidth / deviceHeight
```

#### 2. Scaling and Offset Determination

**Case A: RC wider than device (letterboxing)**
```
if rcAspect > deviceAspect:
    scaleX = deviceWidth / rcWidth
    scaleY = scaleX  (maintain aspect ratio)
    offsetX = 0
    offsetY = (deviceHeight - rcHeight * scaleY) / 2
```

**Case B: RC taller than device (pillarboxing)**
```
if rcAspect < deviceAspect:
    scaleY = deviceHeight / rcHeight
    scaleX = scaleY  (maintain aspect ratio)
    offsetX = (deviceWidth - rcWidth * scaleX) / 2
    offsetY = 0
```

**Case C: Same aspect ratio**
```
if rcAspect == deviceAspect:
    scaleX = deviceWidth / rcWidth
    scaleY = deviceHeight / rcHeight
    offsetX = 0
    offsetY = 0
```

#### 3. Coordinate Transformation

For each RC coordinate `(rcX, rcY)`:
```
deviceX = rcX * scaleX + offsetX
deviceY = rcY * scaleY + offsetY
```

#### 4. Bounds Checking

```
if deviceX < 0 or deviceX >= deviceWidth or 
   deviceY < 0 or deviceY >= deviceHeight:
    return null (invalid coordinate)
```

### Letterboxing and Pillarboxing

When the RC window and device have different aspect ratios, black bars are added:

- **Letterboxing**: Horizontal bars (top and bottom) when RC is wider than device
- **Pillarboxing**: Vertical bars (left and right) when RC is taller than device

The mapper accounts for these bars by:
1. Using uniform scaling (scaleX = scaleY) to maintain aspect ratio
2. Centering the content with appropriate offsets

### Display Rotation

Display rotation is detected via `WindowManager.getDefaultDisplay().getRotation()`:

- `Surface.ROTATION_0`: 0° (portrait)
- `Surface.ROTATION_90`: 90° clockwise (landscape)
- `Surface.ROTATION_180`: 180° (reverse portrait)
- `Surface.ROTATION_270`: 270° clockwise (reverse landscape)

The mapper uses the current display dimensions which already account for rotation, so no additional transformation is needed.

To update when rotation changes:
```kotlin
gestureMapper.updateDisplayMetrics()
```

## Gesture Types

### 1. Tap Gesture

A brief touch at a single point.

**Default Duration**: 100ms

**WebSocket Message Format**:
```json
{
  "event_type": "tap",
  "data": {
    "x": 640.0,
    "y": 360.0,
    "duration": 100
  }
}
```

**Kotlin API**:
```kotlin
service.injectTap(x = 640f, y = 360f, durationMs = 100)
```

### 2. Long Press Gesture

An extended touch at a single point, typically used to show context menus.

**Default Duration**: 600ms

**WebSocket Message Format**:
```json
{
  "event_type": "long_press",
  "data": {
    "x": 640.0,
    "y": 360.0,
    "duration": 600
  }
}
```

**Kotlin API**:
```kotlin
service.injectLongPress(x = 640f, y = 360f, durationMs = 600)
```

### 3. Swipe Gesture

A linear movement from one point to another.

**Default Duration**: 300ms

**WebSocket Message Format**:
```json
{
  "event_type": "swipe",
  "data": {
    "start_x": 100.0,
    "start_y": 500.0,
    "end_x": 900.0,
    "end_y": 500.0,
    "duration": 300
  }
}
```

**Kotlin API**:
```kotlin
service.injectSwipe(
    startX = 100f, 
    startY = 500f, 
    endX = 900f, 
    endY = 500f, 
    durationMs = 300
)
```

### 4. Multi-Step Gesture

A continuous gesture that moves through multiple points, useful for drawing or complex patterns.

**WebSocket Message Format**:
```json
{
  "event_type": "multi_step",
  "data": {
    "points": [
      {"x": 100.0, "y": 100.0},
      {"x": 200.0, "y": 150.0},
      {"x": 300.0, "y": 100.0},
      {"x": 400.0, "y": 150.0}
    ],
    "duration": 500
  }
}
```

**Kotlin API**:
```kotlin
val points = listOf(
    Pair(100f, 100f),
    Pair(200f, 150f),
    Pair(300f, 100f),
    Pair(400f, 150f)
)
service.injectMultiStepGesture(points, durationMs = 500)
```

### 5. Global Actions

System-level actions that don't require coordinates.

**Available Actions**:
- `GLOBAL_ACTION_BACK` (1): Back button
- `GLOBAL_ACTION_HOME` (2): Home button
- `GLOBAL_ACTION_RECENTS` (3): Recent apps
- `GLOBAL_ACTION_NOTIFICATIONS` (4): Notification shade
- `GLOBAL_ACTION_QUICK_SETTINGS` (5): Quick settings
- `GLOBAL_ACTION_POWER_DIALOG` (6): Power dialog
- `GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN` (7): Split screen (API 24+)
- `GLOBAL_ACTION_LOCK_SCREEN` (8): Lock screen (API 28+)
- `GLOBAL_ACTION_TAKE_SCREENSHOT` (9): Screenshot (API 28+)

**WebSocket Message Format**:
```json
{
  "event_type": "global_action",
  "data": {
    "action": 1
  }
}
```

**Kotlin API**:
```kotlin
service.performAction(AccessibilityService.GLOBAL_ACTION_BACK)
```

## Gesture Mapper Initialization

Before injecting gestures with RC coordinates, the GestureMapper must be initialized with the RC window dimensions:

**WebSocket Message Format**:
```json
{
  "event_type": "init_mapper",
  "data": {
    "rc_width": 1280,
    "rc_height": 720
  }
}
```

**Kotlin API**:
```kotlin
service.initializeGestureMapper(rcWidth = 1280, rcHeight = 720)
```

## Usage Flow

### 1. Backend Initiates Session

1. Backend creates an RC session
2. Backend sends session ID and device token to device
3. Device starts RemoteControlService and connects via WebSocket

### 2. Initialize Coordinate Mapping

Backend sends RC window dimensions:
```json
{
  "event_type": "init_mapper",
  "data": {
    "rc_width": 1280,
    "rc_height": 720
  }
}
```

### 3. Send Gesture Commands

Backend sends control events based on user input in RC window:

**Example: User taps at (640, 360) in RC window**
```json
{
  "event_type": "tap",
  "data": {
    "x": 640.0,
    "y": 360.0
  }
}
```

Device receives event, maps coordinates, and injects gesture.

### 4. Handle Display Changes

If device rotation changes, backend can send updated RC dimensions or device will handle it automatically using current display metrics.

## Implementation Details

### GestureDescription API

Android's `GestureDescription` API (API 24+) is used to dispatch gestures:

```kotlin
val path = Path().apply {
    moveTo(startX, startY)
    lineTo(endX, endY)
}

val stroke = GestureDescription.StrokeDescription(path, startTime, duration)
val gesture = GestureDescription.Builder()
    .addStroke(stroke)
    .build()

dispatchGesture(gesture, callback, handler)
```

### Gesture Callbacks

Gesture completion can be monitored via callbacks:

```kotlin
val callback = object : AccessibilityService.GestureResultCallback() {
    override fun onCompleted(gestureDescription: GestureDescription?) {
        Log.d(TAG, "Gesture completed successfully")
    }
    
    override fun onCancelled(gestureDescription: GestureDescription?) {
        Log.w(TAG, "Gesture was cancelled")
    }
}

service.injectTap(x, y, callback = callback)
```

### Thread Safety

All gesture injection methods are thread-safe and can be called from any thread. The AccessibilityService handles dispatching on the appropriate thread.

## Testing

### Unit Tests

The `GestureMapperTest` class provides comprehensive test coverage:

- Coordinate transformation with same aspect ratio
- Coordinate transformation with different aspect ratios
- Letterboxing scenarios
- Pillarboxing scenarios
- Multiple point mapping
- Boundary conditions
- Display rotation handling

**Running Tests**:
```bash
cd android
./gradlew test
```

### Integration Testing

To test gesture injection end-to-end:

1. Install and enable the app on a device
2. Enable the RemoteAccessibilityService in system settings
3. Start the RemoteControlService with a session ID
4. Send control events via WebSocket from backend
5. Observe gesture execution on device

## Limitations

### Android API Restrictions

- **Minimum API**: 24 (Android 7.0) for `GestureDescription` API
- **Continuous gestures**: Maximum duration 60 seconds per stroke
- **Multi-touch**: Not supported through AccessibilityService
- **Simultaneous gestures**: Only one gesture can be dispatched at a time

### Accessibility Service Requirements

- Must be explicitly enabled by user in system settings
- Some manufacturers may restrict accessibility service capabilities
- Battery optimization may affect service persistence

### Coordinate Mapping Limitations

- Assumes rectangular display areas (no curved screens)
- Does not account for system UI elements (status bar, navigation bar)
- Display cutouts (notches) are not considered in mapping

## Security Considerations

### Permission Requirements

The AccessibilityService requires user approval and provides significant capabilities:
- Full screen access
- Input injection
- Window content observation

### Best Practices

1. **Only install on managed devices**: This app should only be deployed on devices under organizational control
2. **Secure WebSocket communication**: Always use WSS (TLS) for control channel
3. **Authentication**: Verify device token and session ID on backend
4. **Session timeout**: Implement automatic session expiration
5. **Audit logging**: Log all gesture commands for security review

## Troubleshooting

### Gestures Not Working

1. **Check AccessibilityService status**: Verify service is enabled in Settings → Accessibility
2. **Verify coordinate mapping**: Ensure `init_mapper` was sent with correct dimensions
3. **Check logs**: Look for error messages in logcat
4. **Test with device coordinates**: Bypass mapper by not initializing it

### Coordinates Incorrect

1. **Verify RC dimensions**: Ensure correct width/height sent to `init_mapper`
2. **Check display rotation**: Call `updateDisplayMetrics()` after rotation
3. **Test mapping**: Use `mapPoint()` directly to verify transformation
4. **Check for system UI**: Account for status bar and navigation bar in RC window

### Performance Issues

1. **Reduce gesture frequency**: Limit to 10-20 gestures per second
2. **Optimize multi-step gestures**: Use fewer points for complex paths
3. **Check device resources**: Ensure device has sufficient CPU/memory

## References

- [Android AccessibilityService Documentation](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [GestureDescription API](https://developer.android.com/reference/android/accessibilityservice/GestureDescription)
- [Creating Custom Gestures](https://developer.android.com/training/gestures/viewgroup)
- [Accessibility Developer Guide](https://developer.android.com/guide/topics/ui/accessibility)
