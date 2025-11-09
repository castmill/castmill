# Android Remote Input Implementation - Quick Start Guide

## Overview
This implementation provides gesture-based remote control for the Castmill Android Player using Android's AccessibilityService API.

## Files Created

### Android Java Implementation
1. **CoordinateMapper.java** - Handles coordinate transformation from remote window to device screen
2. **RemoteInputAccessibilityService.java** - Executes gestures using AccessibilityService
3. **RemoteInputPlugin.java** - Capacitor plugin bridge to JavaScript/TypeScript

### TypeScript/JavaScript Bridge
1. **definitions.ts** - TypeScript type definitions
2. **index.ts** - Plugin registration
3. **web.ts** - Web implementation stub for development

### Configuration
1. **AndroidManifest.xml** - Service registration
2. **remote_input_accessibility_service.xml** - Accessibility service configuration
3. **strings.xml** - Service description string

### Testing
1. **CoordinateMapperTest.java** - 20+ tests for coordinate mapping
2. **RemoteInputAccessibilityServiceTest.java** - Tests for gesture execution
3. **RemoteInputPluginTest.java** - Tests for plugin integration

### Documentation
1. **REMOTE_INPUT.md** - Comprehensive documentation

## Usage Example

```typescript
import { RemoteInput } from './plugins/remote-input';

// Configure remote dimensions
await RemoteInput.setRemoteDimensions({ width: 1920, height: 1080 });

// Check if service is running
const { isRunning } = await RemoteInput.isServiceRunning();
if (!isRunning) {
  console.warn('Accessibility service not enabled');
  return;
}

// Execute a tap
await RemoteInput.executeTap({ x: 100, y: 200 });

// Execute a swipe
await RemoteInput.executeSwipe({
  x1: 100, y1: 500,
  x2: 500, y2: 500,
  duration: 300
});

// Get mapping information
const info = await RemoteInput.getMappingInfo();
console.log('Device:', info.deviceWidth, 'x', info.deviceHeight);
console.log('Scale:', info.scaleX, 'x', info.scaleY);
```

## Setup Requirements

### User Setup
1. Install the app on Android device
2. Go to **Settings → Accessibility**
3. Find **RemoteInputAccessibilityService**
4. Enable the service
5. Grant permissions when prompted

### Developer Setup
1. Ensure Android SDK is installed
2. Build the project: `./gradlew build`
3. Run tests: `./gradlew test`

## Testing

### Unit Tests
```bash
cd packages/platforms/android-player/android
./gradlew test
```

### Manual Testing
1. Enable accessibility service in device settings
2. Use the RemoteInput plugin from JavaScript
3. Verify gestures execute correctly on screen
4. Test with different screen resolutions and orientations

## Architecture Highlights

### Coordinate Mapping
- **Aspect Ratio Matching**: Simple proportional scaling
- **Letterboxing**: Black bars added when aspect ratios differ
- **Rotation Handling**: Automatic detection of device orientation
- **Bounds Clamping**: Ensures coordinates stay within device screen

### Gesture Types
- **Tap**: 100ms duration, single point touch
- **Long Press**: 1000ms duration, triggers context menus
- **Swipe**: Customizable duration (default 300ms), linear motion
- **Multi-Step**: Complex paths with multiple points

### Security
- Requires explicit user permission
- Service cannot be enabled programmatically
- Only works with BIND_ACCESSIBILITY_SERVICE permission
- User must manually enable in Settings

## API Surface

### Configuration Methods
- `setRemoteDimensions(width, height)` - Set remote window size
- `getDeviceDimensions()` - Get device screen size
- `getDisplayRotation()` - Get current rotation
- `getMappingInfo()` - Get mapping configuration details

### Gesture Methods
- `executeTap(x, y)` - Single tap
- `executeLongPress(x, y)` - Long press
- `executeSwipe(x1, y1, x2, y2, duration?)` - Swipe gesture
- `executeMultiStepGesture(points[], duration?)` - Complex path

### Status Methods
- `isServiceRunning()` - Check if accessibility service is active

## Limitations

1. **Android Version**: Requires API 24+ (Android 7.0 Nougat)
2. **User Permission**: Must be manually enabled by user
3. **Gesture Complexity**: No multi-finger gestures (pinch, rotate)
4. **System UI**: Cannot interact with system UI elements
5. **Latency**: Inherent ~50-100ms delay in gesture execution

## Troubleshooting

### Service Not Running
- Check Android version (must be 7.0+)
- Verify accessibility service is enabled in Settings
- Restart the device
- Reinstall the application

### Gestures Not Working
- Ensure remote dimensions are set correctly
- Verify coordinates are within bounds
- Check logcat for error messages
- Test with getMappingInfo() to debug values

### Coordinate Mapping Issues
- Verify remote dimensions match actual window
- Check device rotation
- Review letterbox calculations
- Test with different aspect ratios

## Next Steps

1. Build the Android app with the new code
2. Test on actual Android device or emulator
3. Verify all gesture types work correctly
4. Test coordinate mapping with various screen sizes
5. Document any device-specific issues or quirks
6. Consider adding rate limiting for gesture commands
7. Implement session management and authentication

## References

- See REMOTE_INPUT.md for complete documentation
- Android AccessibilityService: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- GestureDescription API: https://developer.android.com/reference/android/accessibilityservice/GestureDescription
- Capacitor Plugins: https://capacitorjs.com/docs/plugins
