# Android Remote Input via AccessibilityService

This documentation describes the implementation of gesture-based remote control for the Castmill Android Player using Android's AccessibilityService API.

## Overview

The remote input system allows external applications to control the Android device through gestures (taps, long presses, swipes, and multi-step gestures). It uses Android's `AccessibilityService` with `GestureDescription` API to inject touch events at the system level.

## Architecture

### Components

1. **RemoteInputAccessibilityService**
   - Android AccessibilityService that executes gestures
   - Manages singleton instance for global access
   - Handles gesture execution via `GestureDescription` API

2. **CoordinateMapper**
   - Maps remote control window coordinates to device screen coordinates
   - Handles aspect ratio differences through letterboxing
   - Accounts for display rotation and resolution differences

3. **RemoteInputPlugin**
   - Capacitor plugin providing JavaScript/TypeScript bridge
   - Exposes gesture execution methods to web layer
   - Manages coordinate mapping configuration

### Class Diagram

```
RemoteInputPlugin (Capacitor Plugin)
         ↓ calls
RemoteInputAccessibilityService (AccessibilityService)
         ↓ uses
CoordinateMapper (Utility)
```

## Coordinate Mapping

### Aspect Ratio Handling

The `CoordinateMapper` handles three scenarios:

1. **Matching Aspect Ratios**: Simple proportional scaling
   - Remote: 1920×1080 → Device: 3840×2160 (both 16:9)
   - Scale factor: 2.0x for both axes

2. **Wider Remote (Letterbox Top/Bottom)**
   - Remote: 1920×1080 (16:9) → Device: 1200×1200 (1:1)
   - Scale to fit width, add black bars top/bottom
   - Vertical offset applied to center content

3. **Taller Remote (Letterbox Left/Right)**
   - Remote: 1080×1920 (9:16) → Device: 1200×1200 (1:1)
   - Scale to fit height, add black bars left/right
   - Horizontal offset applied to center content

### Coordinate Transformation Formula

```java
// Calculate aspect ratios
remoteAspect = remoteWidth / remoteHeight
deviceAspect = deviceWidth / deviceHeight

// Determine scale and offset
if (remoteAspect ≈ deviceAspect) {
    scaleX = deviceWidth / remoteWidth
    scaleY = deviceHeight / remoteHeight
    offsetX = 0, offsetY = 0
} else if (remoteAspect > deviceAspect) {
    // Letterbox top/bottom
    scaleX = scaleY = deviceWidth / remoteWidth
    offsetY = (deviceHeight - remoteHeight * scaleY) / 2
} else {
    // Letterbox left/right
    scaleX = scaleY = deviceHeight / remoteHeight
    offsetX = (deviceWidth - remoteWidth * scaleX) / 2
}

// Transform coordinates
deviceX = remoteX * scaleX + offsetX
deviceY = remoteY * scaleY + offsetY
```

### Display Rotation

The coordinate mapper accounts for device rotation by querying the current display rotation state:
- `Surface.ROTATION_0`: Portrait (0°)
- `Surface.ROTATION_90`: Landscape (90°)
- `Surface.ROTATION_180`: Reverse portrait (180°)
- `Surface.ROTATION_270`: Reverse landscape (270°)

## Gesture Types

### 1. Tap Gesture

Quick touch at a single point.

```java
// Java
service.executeTap(x, y, callback);

// JavaScript
await RemoteInput.executeTap({ x: 100, y: 200 });
```

**Duration**: 100ms

### 2. Long Press Gesture

Extended touch at a single point, typically used to trigger context menus.

```java
// Java
service.executeLongPress(x, y, callback);

// JavaScript
await RemoteInput.executeLongPress({ x: 100, y: 200 });
```

**Duration**: 1000ms

### 3. Swipe Gesture

Linear movement from one point to another.

```java
// Java
service.executeSwipe(x1, y1, x2, y2, durationMs, callback);

// JavaScript
await RemoteInput.executeSwipe({
  x1: 100, y1: 100,
  x2: 200, y2: 200,
  duration: 300  // optional, default 300ms
});
```

**Default Duration**: 300ms

### 4. Multi-Step Gesture

Complex path following multiple points, useful for drawing or tracing gestures.

```java
// Java
Point[] points = { new Point(100, 100), new Point(150, 150), new Point(200, 200) };
service.executeMultiStepGesture(points, 500, callback);

// JavaScript
await RemoteInput.executeMultiStepGesture({
  points: [
    { x: 100, y: 100 },
    { x: 150, y: 150 },
    { x: 200, y: 200 }
  ],
  duration: 500
});
```

**Minimum Points**: 2

## Usage

### 1. Enable Accessibility Service

Users must manually enable the accessibility service in Android Settings:

**Settings → Accessibility → RemoteInputAccessibilityService → Enable**

### 2. Configure Remote Dimensions

Before executing gestures, set the remote control window dimensions:

```javascript
await RemoteInput.setRemoteDimensions({
  width: 1920,
  height: 1080
});
```

### 3. Execute Gestures

```javascript
// Check if service is running
const { isRunning } = await RemoteInput.isServiceRunning();

if (isRunning) {
  // Execute tap
  await RemoteInput.executeTap({ x: 100, y: 200 });
  
  // Execute swipe
  await RemoteInput.executeSwipe({
    x1: 100, y1: 500,
    x2: 500, y2: 500,
    duration: 300
  });
}
```

### 4. Query Mapping Information

Get information about the current coordinate mapping:

```javascript
const info = await RemoteInput.getMappingInfo();
console.log(`Device: ${info.deviceWidth}x${info.deviceHeight}`);
console.log(`Offset: (${info.offsetX}, ${info.offsetY})`);
console.log(`Scale: ${info.scaleX}x${info.scaleY}`);
```

## API Reference

### RemoteInputPlugin Methods

#### `setRemoteDimensions(width, height)`
Sets the remote control window dimensions for coordinate mapping.

**Parameters:**
- `width` (number): Remote window width in pixels
- `height` (number): Remote window height in pixels

**Returns:** `Promise<{ width: number, height: number }>`

---

#### `getDeviceDimensions()`
Gets the current device screen dimensions.

**Returns:** `Promise<{ width: number, height: number }>`

---

#### `getDisplayRotation()`
Gets the current display rotation.

**Returns:** `Promise<{ rotation: number }>`
- `0`: Portrait
- `1`: Landscape (90°)
- `2`: Reverse portrait (180°)
- `3`: Reverse landscape (270°)

---

#### `executeTap(x, y)`
Executes a tap gesture at the specified coordinates.

**Parameters:**
- `x` (number): X coordinate in remote window
- `y` (number): Y coordinate in remote window

**Returns:** `Promise<void>`

---

#### `executeLongPress(x, y)`
Executes a long press gesture at the specified coordinates.

**Parameters:**
- `x` (number): X coordinate in remote window
- `y` (number): Y coordinate in remote window

**Returns:** `Promise<void>`

---

#### `executeSwipe(x1, y1, x2, y2, duration?)`
Executes a swipe gesture between two points.

**Parameters:**
- `x1` (number): Start X coordinate in remote window
- `y1` (number): Start Y coordinate in remote window
- `x2` (number): End X coordinate in remote window
- `y2` (number): End Y coordinate in remote window
- `duration` (number, optional): Duration in milliseconds (default: 300)

**Returns:** `Promise<void>`

---

#### `executeMultiStepGesture(points, duration?)`
Executes a multi-step gesture following a path of points.

**Parameters:**
- `points` (Array<{x: number, y: number}>): Array of points (minimum 2)
- `duration` (number, optional): Total duration in milliseconds (default: 500)

**Returns:** `Promise<void>`

---

#### `isServiceRunning()`
Checks if the accessibility service is running.

**Returns:** `Promise<{ isRunning: boolean }>`

---

#### `getMappingInfo()`
Gets information about coordinate mapping configuration.

**Returns:** 
```typescript
Promise<{
  deviceWidth: number,
  deviceHeight: number,
  offsetX: number,
  offsetY: number,
  scaleX: number,
  scaleY: number
}>
```

## Security Considerations

### Permission Requirements

The accessibility service requires explicit user permission:
- Users must manually enable the service in Android Settings
- The service requires `BIND_ACCESSIBILITY_SERVICE` permission
- The service can only be enabled by the user, not programmatically

### Best Practices

1. **Validate Input**: Always validate coordinates before executing gestures
2. **Rate Limiting**: Consider implementing rate limiting for gesture execution
3. **User Consent**: Clearly communicate why accessibility permission is needed
4. **Secure Communication**: Use encrypted channels for remote control commands
5. **Session Management**: Implement proper authentication for remote sessions

## Testing

### Unit Tests

The implementation includes comprehensive unit tests:

1. **CoordinateMapperTest**: Tests coordinate transformation, letterboxing, and rotation
2. **RemoteInputAccessibilityServiceTest**: Tests gesture execution and callbacks
3. **RemoteInputPluginTest**: Tests plugin methods and service integration

Run tests:
```bash
cd packages/platforms/android-player/android
./gradlew test
```

### Manual Testing Checklist

- [ ] Enable accessibility service in Settings
- [ ] Execute tap gesture on UI element
- [ ] Execute long press to trigger context menu
- [ ] Execute swipe gesture (horizontal and vertical)
- [ ] Execute multi-step gesture (circular motion)
- [ ] Test with different remote resolutions
- [ ] Test with device rotation changes
- [ ] Test with different screen aspect ratios
- [ ] Verify coordinate mapping accuracy
- [ ] Test gesture cancellation

## Limitations

1. **Android Version**: Requires Android 7.0 (API 24) or higher for GestureDescription API
2. **User Permission**: Requires manual enabling of accessibility service
3. **Gesture Complexity**: Complex multi-finger gestures are not supported
4. **Performance**: Gesture execution has inherent latency (~50-100ms)
5. **System UI**: Cannot interact with system UI elements (notification shade, nav bar)

## Troubleshooting

### Service Not Running

**Problem**: `isServiceRunning()` returns false

**Solutions**:
1. Check if accessibility service is enabled in Settings
2. Restart the device
3. Reinstall the application
4. Check Android version (requires API 24+)

### Gestures Not Executing

**Problem**: Gestures are called but don't execute

**Solutions**:
1. Verify remote dimensions are set correctly
2. Check coordinate values are within bounds
3. Ensure service has proper permissions
4. Review logcat for error messages

### Coordinate Mapping Incorrect

**Problem**: Gestures appear at wrong locations

**Solutions**:
1. Verify remote dimensions match actual remote window
2. Check device rotation is accounted for
3. Review letterbox offset calculations
4. Test with `getMappingInfo()` to debug values

## Future Enhancements

Potential improvements for future versions:

1. **Multi-Touch Gestures**: Support pinch-to-zoom, two-finger swipe
2. **Gesture Recording**: Record and replay gesture sequences
3. **Performance Optimization**: Reduce gesture execution latency
4. **Adaptive Mapping**: Auto-detect remote dimensions from video stream
5. **Gesture Templates**: Pre-defined gestures for common actions
6. **Haptic Feedback**: Provide feedback when gestures execute

## References

- [Android AccessibilityService Documentation](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [GestureDescription API](https://developer.android.com/reference/android/accessibilityservice/GestureDescription)
- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins)

## License

This implementation is part of the Castmill Android Player and is licensed under AGPL-3.0-or-later.
