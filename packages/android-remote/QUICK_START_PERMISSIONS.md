# Quick Start Guide - Permissions Setup

This guide provides step-by-step instructions for setting up permissions for the Castmill Android Remote Control service.

## For End Users (Standard Installation)

### Prerequisites
- Android device running Android 8.0 (Oreo) or later
- APK file for Castmill Remote app

### Step 1: Install the App

1. Enable installation from unknown sources:
   - Android 8.0+: Go to Settings → Apps → Special Access → Install Unknown Apps
   - Select your browser or file manager and enable "Allow from this source"

2. Download and open the APK file
3. Tap "Install" and wait for completion
4. Tap "Open" or find the app in your app drawer

### Step 2: Enable Accessibility Service

**Why:** Required for remote gesture control (tap, swipe, key press)

1. Open the Castmill Remote app
2. You'll see a card labeled "Accessibility Service" with status "Disabled"
3. Tap the "Enable Accessibility Service" button
4. Read the explanation dialog and tap "Open Settings"
5. In Android Settings → Accessibility:
   - Scroll down to find "Castmill Remote" in the services list
   - Tap on "Castmill Remote"
   - Toggle the switch to ON
   - Read and accept the warning dialog
6. Press the back button to return to the Castmill Remote app
7. Verify the status now shows "Enabled" with a green indicator

**Troubleshooting:**
- If you don't see "Castmill Remote" in Accessibility settings, restart the device
- If the toggle immediately turns off, check battery optimization settings
- If you get an error, ensure the app is installed correctly

### Step 3: Grant Screen Capture Permission

**Why:** Required for remote viewing of the device screen

**Important:** This permission must be granted each time you start a remote control session. This is an Android security requirement.

1. In the Castmill Remote app, you'll see a card labeled "Screen Capture"
2. Tap the "Grant Screen Capture" button
3. Read the explanation dialog and tap "I Understand"
4. A system dialog will appear saying "Castmill Remote will start capturing everything displayed on your screen"
5. Tap "Start now" to grant permission
6. Verify the status shows "Granted" with a green indicator

**Note:** When you restart the app or end a remote session, you'll need to grant this permission again. This is normal Android behavior.

### Step 4: Verify Setup

Your app should now show:
- ✅ Device ID displayed (note this for backend configuration)
- ✅ Accessibility Service: Enabled (green)
- ✅ Screen Capture: Granted (green)
- Service Status: "Remote control service is not running"

The service will start automatically when a remote control session is requested from the backend.

---

## For IT Administrators (Managed Devices)

If you're deploying to corporate-owned devices in kiosk mode or digital signage, you can use Device Owner policies to auto-grant the MediaProjection permission.

### Prerequisites
- Android devices configured as fully managed (Device Owner mode)
- Mobile Device Management (MDM) solution (Google Workspace, AirWatch, etc.)
- Organization-owned devices (not BYOD)

### Device Owner Enrollment

#### Option 1: New Device Enrollment (Recommended)

1. **Factory Reset the Device**
   - Do NOT add any Google accounts
   - Do NOT complete the initial setup

2. **Enroll During Setup**
   - For Google Workspace (Android Device Policy):
     - Tap the screen 6 times to activate QR code scanner
     - Scan enrollment QR code from Google Admin Console
     - Device automatically provisions as fully managed
   - For other MDM solutions:
     - Follow your MDM's enrollment procedure
     - Typically involves entering enrollment credentials or scanning a code

3. **Verify Device Owner Status**
   ```bash
   adb shell dpm list-owners
   # Should show your MDM as device owner
   ```

#### Option 2: Test Environment (ADB Method)

For development/testing only:

```bash
# 1. Factory reset device or use a clean emulator
# 2. Do NOT complete Android setup
# 3. Connect via ADB

# Install the app
adb install castmill-remote.apk

# Set as device owner (requires DeviceAdminReceiver in app)
adb shell dpm set-device-owner com.castmill.androidremote/.DeviceAdminReceiver

# Grant media projection permission
adb shell appops set com.castmill.androidremote PROJECT_MEDIA allow
```

**Note:** This method only works for debug builds and testing. Production deployments must use proper MDM enrollment.

### MDM Configuration

#### Google Workspace (Android Device Policy)

1. **Access Google Admin Console**
   - Navigate to Devices → Mobile & Endpoints → Settings → Apps

2. **Add Castmill Remote App**
   - Click "Add App"
   - Upload APK or link to private app in Play Store
   - Configure app settings

3. **Configure Permissions Policy**
   - Select "Castmill Remote" from apps list
   - Go to "Managed Configurations"
   - Set permission policy:
     - Screen Capture: "Auto-grant"
     - Foreground Service: "Auto-grant"

4. **Deploy to Devices**
   - Assign app to device group
   - App installs automatically
   - MediaProjection permission is pre-approved

#### Other MDM Solutions (AirWatch, MobileIron, etc.)

Configuration varies by MDM provider. General steps:

1. Upload APK to MDM console
2. Create application policy
3. Set permissions to auto-grant:
   - `android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION`
4. Assign policy to device group
5. Deploy app

Consult your MDM documentation for specific instructions.

### AccessibilityService Setup (Still Required)

**Important:** Even with Device Owner policies, Android does not allow auto-enabling of AccessibilityService.

You must still:
1. Manually enable the service on each device:
   - Settings → Accessibility → Castmill Remote → Enable
2. Accept the warning dialog

**Workaround for Kiosk Deployments:**
- Use Device Owner's input injection APIs (requires custom implementation)
- Create a kiosk launcher that restricts access to only the Castmill Player
- Pre-enable service via ADB during initial setup (only persists until factory reset)

### Deployment Checklist

Before deploying to production:

- [ ] All devices are enrolled as Device Owner
- [ ] Castmill Remote app is deployed via MDM
- [ ] MediaProjection permission is auto-granted (verify on test device)
- [ ] AccessibilityService is manually enabled on each device
- [ ] Device IDs are collected and registered in backend
- [ ] Network connectivity is verified (WSS access to backend)
- [ ] Foreground notification is visible when service runs
- [ ] Test remote control session end-to-end

### Monitoring and Maintenance

**Check Permission Status:**
```bash
adb shell dumpsys accessibility | grep -A 10 "castmill"
adb shell appops get com.castmill.androidremote PROJECT_MEDIA
```

**Check Service Status:**
```bash
adb shell dumpsys activity services com.castmill.androidremote
```

**View Logs:**
```bash
adb logcat -s RemoteControlService:* MainActivity:* RemoteAccessibilityService:*
```

**Troubleshooting Common Issues:**

1. **Service not starting:**
   - Check notification appears
   - Verify device token and session ID are valid
   - Check logcat for errors

2. **Screen capture not working:**
   - Verify Device Owner is properly configured
   - Check permission policy in MDM
   - Try manual grant to test hardware compatibility

3. **Gestures not injecting:**
   - Verify AccessibilityService is enabled
   - Check no other accessibility services are conflicting
   - Test with simple tap gesture first

### Security Recommendations

For managed device deployments:

1. **Network Security:**
   - Use VPN for device connections
   - Implement certificate pinning
   - Monitor WebSocket traffic

2. **Access Control:**
   - Limit backend access to authorized users
   - Implement session timeouts (recommended: 15-30 minutes)
   - Require re-authentication for sensitive operations

3. **Audit and Compliance:**
   - Log all remote control sessions
   - Track gesture injection events
   - Implement alerts for unusual activity
   - Retain logs per compliance requirements

4. **Device Management:**
   - Regular security updates
   - Remote wipe capability
   - Device location tracking
   - Enforce screen lock policies

---

## Support and Resources

### Documentation
- [README.md](README.md) - General overview and usage
- [PERMISSIONS.md](PERMISSIONS.md) - Comprehensive permission documentation
- [IMPLEMENTATION.md](IMPLEMENTATION.md) - Technical implementation details

### Common Questions

**Q: Why do I need to grant screen capture permission every time?**  
A: This is an Android security requirement. MediaProjection is a dangerous permission that allows access to all screen content. Android requires explicit user consent for each session. Device Owner policies can bypass this for managed devices.

**Q: Can I disable the notification?**  
A: No, the persistent notification is required by Google Play Store policies for foreground services. You can collapse it to minimize screen space, but it cannot be completely dismissed while the service is running.

**Q: Why can't AccessibilityService be auto-enabled?**  
A: Android prevents automatic enabling of accessibility services for security reasons. Even Device Owner policies cannot override this. The service must be manually enabled by a user with physical access to the device.

**Q: Is this app secure?**  
A: The app implements industry-standard security practices (WSS encryption, token authentication). However, it provides powerful capabilities (screen capture, input injection) and should only be deployed on managed devices in controlled environments. See [PERMISSIONS.md - Security Considerations](PERMISSIONS.md#security-considerations).

**Q: Can I use this on my personal phone?**  
A: While technically possible, this app is designed for corporate-owned devices used for digital signage. The required permissions provide significant device access and should only be granted on devices you fully control.

### Getting Help

- Check [PERMISSIONS.md - Troubleshooting](PERMISSIONS.md#troubleshooting)
- Review logcat output for error messages
- Verify network connectivity to backend
- Ensure Android version is 8.0 or later
- Test on multiple devices to rule out device-specific issues

---

*Last updated: 2024*
