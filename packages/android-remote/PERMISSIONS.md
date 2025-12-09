# Permissions and User Consent

This document details the permission requirements, consent flows, and deployment options for the Castmill Android Remote Control service.

## Overview

The Castmill Android Remote Control service requires two critical permissions to function:

1. **AccessibilityService** - For remote gesture injection (tap, swipe, key press)
2. **MediaProjection** - For screen capture and remote viewing

Both permissions involve sensitive device capabilities and require explicit user consent or device management policies.

## Permission Requirements

### 1. AccessibilityService Permission

**Purpose**: Enables remote control of touch events and gestures on the device.

**Capabilities Granted**:
- Inject touch events (tap, long press, swipe)
- Inject multi-step gestures
- Perform global actions (back, home, recents)
- Read screen content (required by Android, not actively used)

**Declaration**: Configured in `AndroidManifest.xml` and `accessibility_service_config.xml`

**Permission Level**: Accessibility service (requires manual user setup)

**User Action Required**: 
- Must navigate to Settings → Accessibility → Castmill Remote → Enable
- System shows warning dialog about capabilities being granted
- User must acknowledge and accept the warning

### 2. MediaProjection Permission

**Purpose**: Enables screen capture for remote viewing.

**Capabilities Granted**:
- Capture device screen content
- Record video of screen activity
- Access to all visible content on screen

**Declaration**: `FOREGROUND_SERVICE_MEDIA_PROJECTION` in `AndroidManifest.xml`

**Permission Level**: Dangerous (requires runtime permission)

**User Action Required**:
- System shows permission dialog when requested
- User must tap "Start now" or equivalent to grant
- Permission is NOT persistent by Android design - must be re-requested for each app session
- **Auto-request on subsequent launches**: After first grant, permission is automatically re-requested on app launch to minimize user friction

## Consent Flows

### Track 1: Manual Consent Flow (MVP - Current Implementation)

This is the standard Android permission flow suitable for most deployments.

#### AccessibilityService Setup Flow

```
User opens MainActivity
    ↓
Sees "Accessibility Service" card with "Disabled" status
    ↓
Taps "Enable Accessibility Service" button
    ↓
Sees explanation dialog with instructions
    ↓
Taps "Open Settings"
    ↓
Redirected to Android Accessibility Settings
    ↓
User finds "Castmill Remote" in the list
    ↓
User toggles service ON
    ↓
System shows warning dialog
    ↓
User reads and accepts warning
    ↓
Service is enabled
    ↓
User returns to MainActivity
    ↓
Status updates to "Enabled" with green indicator
```

**Implementation Notes**:
- Cannot be automated - Android requires manual user interaction
- App provides clear UI guidance to help users through the process
- Status is checked in `onResume()` to update UI when user returns
- Once enabled, remains enabled until user disables it

#### MediaProjection Permission Flow

**First Launch:**
```
User opens MainActivity for the first time
    ↓
Sees "Screen Capture" card with "Not Granted" status
    ↓
Taps "Grant Screen Capture" button
    ↓
Sees explanation dialog about screen capture
    ↓
Taps "I Understand"
    ↓
System shows MediaProjection permission dialog
    ↓
Dialog displays: "Castmill Remote will start capturing everything displayed on your screen"
    ↓
User taps "Start now" to grant permission
    ↓
Permission granted for this session
    ↓
App stores flag indicating user has granted permission before
    ↓
Status updates to "Granted" with green indicator
```

**Subsequent Launches (Auto-Request):**
```
User opens MainActivity (not first time)
    ↓
App detects user granted permission before
    ↓
App automatically requests MediaProjection permission (500ms delay)
    ↓
System shows MediaProjection permission dialog
    ↓
User taps "Start now" to grant permission
    ↓
Permission granted for this session
    ↓
Status updates to "Granted" with green indicator
```

**Implementation Notes**:
- Permission must be requested from an Activity (not a Service)
- Permission is granted per-session, not persistent (Android security design)
- Must be re-requested when:
  - App is restarted (auto-requested if granted before)
  - Remote control session ends and new one begins
  - User revokes permission manually
- `resultCode` and `data` Intent must be passed to RemoteControlService
- Permission can be requested just-in-time when starting a remote session
- **Auto-request feature**: After first grant, app automatically requests permission on launch to reduce user friction
- Auto-request is tracked via SharedPreferences flag: `media_projection_granted_before`

**Typical Integration Flow**:
```kotlin
// 1. Backend initiates remote control session (e.g., via push notification)
// 2. App receives session ID and device token
// 3. App checks if MediaProjection permission is needed
// 4. If needed, MainActivity requests permission
// 5. On permission grant, start RemoteControlService with permission data

fun onRemoteSessionRequested(sessionId: String, deviceToken: String) {
    if (needsScreenCapture) {
        // Request permission
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        
        // Store session details for later use
        pendingSessionId = sessionId
        pendingDeviceToken = deviceToken
    }
}

override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == REQUEST_MEDIA_PROJECTION && resultCode == RESULT_OK) {
        // Start service with screen capture
        startRemoteControlServiceWithCapture(
            sessionId = pendingSessionId!!,
            deviceToken = pendingDeviceToken!!,
            mediaProjectionResultCode = resultCode,
            mediaProjectionData = data!!
        )
    }
}
```

### Track 2: Device Owner Auto-Grant (Managed Device Deployment)

For enterprise deployments with full device management, MediaProjection permission can be auto-granted via Device Owner policies.

#### What is Device Owner Mode?

Device Owner is an Android enterprise feature that allows an MDM (Mobile Device Management) solution to control a device at the system level. This is intended for corporate-owned devices that are fully managed.

**Requirements**:
- Device must be factory reset and enrolled during initial setup
- Device must not have any user accounts configured
- Must use Android Device Policy or equivalent MDM solution
- Organization must have Google Workspace or Cloud Identity

#### Capabilities in Device Owner Mode

When a device is under Device Owner control, the MDM can:
- Pre-approve permissions without user interaction
- Auto-grant MediaProjection permission
- Install and configure apps silently
- Lock down device settings
- Enforce security policies

#### Setting Up Device Owner

**Option A: Android Device Policy (Google Workspace)**

1. **Prepare Device**:
   - Factory reset the device
   - Do NOT add any Google accounts
   - Skip all optional setup steps

2. **Enroll Device**:
   - During initial setup, tap screen 6 times to enter QR code scanner
   - Scan enrollment QR code generated from Google Admin Console
   - Device downloads Android Device Policy app
   - App provisions device as fully managed

3. **Configure Policies** (in Google Admin Console):
   ```
   Devices → Configuration → Apps → Castmill Remote
   ├── Auto-install app
   ├── Grant all permissions
   └── Enable "Screen capture" permission policy
   ```

4. **Deploy App**:
   - App is installed automatically
   - MediaProjection permission is pre-approved
   - AccessibilityService still requires manual enable (Android restriction)

**Option B: Third-Party MDM (AirWatch, MobileIron, etc.)**

Similar process but configuration is done through the MDM's admin console. Specific steps vary by MDM provider.

#### Auto-Granting MediaProjection

Once Device Owner is established, configure the permission policy:

```xml
<!-- Example policy configuration (MDM-dependent) -->
<permission-policy>
    <application package="com.castmill.androidremote">
        <permission name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" 
                    policy="grant" />
    </application>
</permission-policy>
```

**Result**:
- When RemoteControlService starts with MediaProjection, permission is automatically granted
- No user dialog appears
- Screen capture begins immediately
- Suitable for kiosk deployments and unmanned devices

#### Limitations of Device Owner

**Cannot Auto-Grant**:
- AccessibilityService - Android security policy prevents auto-enable
  - Must still be manually enabled by user
  - Alternative: Use Device Owner's input injection APIs (requires custom implementation)
- Certain dangerous permissions on some Android versions

**Device Owner vs. Profile Owner**:
- Device Owner: Full device control (corporate-owned)
- Profile Owner: Work profile only (BYOD scenarios)
- MediaProjection auto-grant typically requires Device Owner

#### Testing Device Owner Locally

For development/testing:

```bash
# 1. Factory reset device or use emulator
# 2. Connect via ADB (do NOT complete Android setup)
# 3. Install app via ADB
adb install app-debug.apk

# 4. Set app as Device Owner
adb shell dpm set-device-owner com.castmill.androidremote/.DeviceAdminReceiver

# 5. Grant permission
adb shell appops set com.castmill.androidremote PROJECT_MEDIA allow

# Note: This requires a DeviceAdminReceiver to be added to the app
# See: https://developer.android.com/work/dpc/build-dpc
```

**Important**: Device Owner setup via ADB only works on debug builds and test devices. Production deployments must use proper MDM enrollment.

## Foreground Service Notification

### Play Store Requirements

Google Play Store requires all foreground services to display a persistent notification that:

1. Clearly describes what the service is doing
2. Cannot be dismissed by the user (ongoing)
3. Uses an appropriate notification channel
4. Provides a way to stop the service (via pending intent)

### Implementation

The RemoteControlService creates a notification channel and displays a persistent notification:

**Channel Configuration**:
```kotlin
NotificationChannel(
    id = "castmill_remote_control",
    name = "Remote Control Service", 
    importance = IMPORTANCE_LOW  // Minimizes disruption
)
```

**Notification Content**:
- **Title**: "Castmill Remote Control"
- **Text**: Status message (e.g., "Connected - Remote control active")
- **Icon**: Standard Android system icon (should be replaced with app icon)
- **Priority**: LOW to reduce interruptions
- **Ongoing**: true (cannot be dismissed)
- **Action**: Tap to open MainActivity

**Status Messages**:
- "Initializing remote control service…" - Service starting
- "Connected - Remote control active" - WebSocket connected
- "Disconnected - Attempting to reconnect…" - Connection lost
- "Screen capture active" - Screen capture in progress
- "Error: [message]" - Error state

### User Experience

The notification:
- Appears in the status bar when service is running
- Is visible in the notification shade
- Cannot be swiped away (ongoing)
- Can be collapsed to minimize screen space
- Tapping opens MainActivity for status/control

## Security Considerations

### Risk Assessment

Both permissions provide significant device access:

**AccessibilityService Risks**:
- Can inject arbitrary touch events
- Can read screen content
- Could be used maliciously for keylogging or unauthorized control

**MediaProjection Risks**:
- Captures all on-screen content including sensitive data
- Could record passwords, personal information, etc.
- No per-app granularity - captures everything

### Mitigation Strategies

1. **Deploy Only on Managed Devices**:
   - Install only on corporate-owned devices
   - Use MDM for policy enforcement
   - Monitor device compliance

2. **Network Security**:
   - Use WSS (WebSocket Secure) with TLS
   - Authenticate with device tokens
   - Implement session timeouts
   - Validate session IDs on backend

3. **Audit and Monitoring**:
   - Log all remote control sessions
   - Track gesture injection events
   - Alert on suspicious activity
   - Implement session recording (backend)

4. **User Awareness**:
   - Clear permission dialogs explaining capabilities
   - Visible notification when service is active
   - Easy way to disable service (MainActivity)
   - Documentation for IT administrators

5. **Access Control**:
   - Require authentication for remote sessions
   - Implement role-based access control (backend)
   - Time-limited sessions
   - Require approval for sensitive actions

### Compliance Considerations

**GDPR / Privacy**:
- Screen capture may include personal data
- Document data handling in privacy policy
- Provide user notice about remote monitoring
- Implement data retention policies

**Industry-Specific**:
- Healthcare (HIPAA): Screen capture of PHI requires additional controls
- Finance (PCI-DSS): May not be suitable for payment processing screens
- Government: May require additional security certifications

## Troubleshooting

### AccessibilityService Not Enabling

**Symptom**: Toggle in Settings doesn't stay on or immediately turns off.

**Possible Causes**:
1. Battery optimization killing service
2. Manufacturer restrictions (some OEMs block accessibility services)
3. App not properly signed
4. Service configuration error

**Solutions**:
- Disable battery optimization for the app
- Check manufacturer documentation for accessibility restrictions
- Verify `accessibility_service_config.xml` is correct
- Check logcat for service lifecycle messages

### MediaProjection Permission Denied

**Symptom**: Permission dialog appears but user denies, or no dialog appears.

**Possible Causes**:
1. Requesting from Service instead of Activity
2. User explicitly denied permission
3. Android version restrictions (requires API 21+)
4. Device policy blocking screen capture

**Solutions**:
- Always request from MainActivity (Activity context required)
- Show explanation dialog before system dialog
- Check Android version compatibility
- Verify no MDM policy blocks screen capture

### Notification Not Appearing

**Symptom**: Service starts but no notification appears, or service crashes.

**Possible Causes**:
1. Channel not created before starting foreground
2. Android 13+ notification permission not granted
3. Notification ID conflict

**Solutions**:
- Create channel in `onCreate()` before `startForeground()`
- Request `POST_NOTIFICATIONS` permission on Android 13+
- Use unique notification ID

## Best Practices

### For Deployment

1. **Test Permission Flows**: 
   - Test on multiple Android versions (8.0+)
   - Test on different manufacturers (Samsung, Pixel, etc.)
   - Document any device-specific issues

2. **Provide Clear Documentation**:
   - Create setup guide for IT administrators
   - Include screenshots of permission dialogs
   - Document Device Owner setup process

3. **Monitor and Support**:
   - Implement analytics to track permission grant rates
   - Provide support contact for permission issues
   - Create FAQ for common problems

4. **Gradual Rollout**:
   - Start with pilot group for testing
   - Gather feedback on permission flows
   - Refine UI/messaging based on feedback

### For Users

1. **Grant Permissions Carefully**:
   - Only install on devices you control
   - Review what capabilities are being granted
   - Disable service when not needed

2. **Monitor Active Sessions**:
   - Check notification to see if service is running
   - Open MainActivity to see connection status
   - Report unexpected activity

3. **Keep App Updated**:
   - Updates may include security fixes
   - New versions may improve permission handling
   - Check release notes for changes

## References

- [Android AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [MediaProjection API](https://developer.android.com/reference/android/media/projection/MediaProjection)
- [Android Enterprise Documentation](https://developers.google.com/android/work)
- [Device Owner Setup Guide](https://developers.google.com/android/work/requirements/device-owner)
- [Foreground Services](https://developer.android.com/guide/components/foreground-services)
- [App Permissions Best Practices](https://developer.android.com/training/permissions/requesting)

## Summary

| Permission | Type | User Action | Device Owner | Persistent | Auto-Request |
|------------|------|-------------|--------------|------------|--------------|
| AccessibilityService | Accessibility | Manual enable in Settings | No auto-grant | Yes, until disabled | No |
| MediaProjection | Dangerous | Grant per-session | Can auto-grant | No, per-session | Yes, after first grant |
| Foreground Service | Normal | Automatic | N/A | While service runs | N/A |

**Track 1 (Manual Consent)**: Standard Android permission flows with clear UI guidance. MediaProjection is automatically re-requested on app launch after first grant to minimize user friction.

**Track 2 (Device Owner)**: Enterprise deployment with auto-granted MediaProjection for fully managed devices.

Both tracks require AccessibilityService to be manually enabled due to Android security restrictions.
