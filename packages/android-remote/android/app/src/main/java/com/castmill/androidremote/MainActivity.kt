package com.castmill.androidremote

import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * MainActivity for Castmill Android Remote Control
 * 
 * This activity serves as the entry point for the remote control service.
 * It handles permissions for MediaProjection and AccessibilityService.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_MEDIA_PROJECTION = 1001
        private const val REQUEST_ACCESSIBILITY = 1002
    }

    private lateinit var mediaProjectionManager: MediaProjectionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize MediaProjection manager
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        
        // TODO: Add UI layout
        // For now, this is a minimal setup
        
        checkPermissions()
        
        // Display device ID for debugging
        val deviceId = DeviceUtils.getDeviceId(this)
        Log.i(TAG, "Device ID: $deviceId")
    }

    /**
     * Check and request necessary permissions
     */
    private fun checkPermissions() {
        // Check if accessibility service is enabled
        if (!isAccessibilityServiceEnabled()) {
            // TODO: Show UI to guide user to enable accessibility service
            // openAccessibilitySettings()
        }
        
        // Check if we need to request screen capture permission
        // This will be handled when the service starts
    }

    /**
     * Check if the accessibility service is enabled
     */
    private fun isAccessibilityServiceEnabled(): Boolean {
        val service = "${packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        return enabledServices?.contains(service) == true
    }

    /**
     * Open accessibility settings
     */
    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivityForResult(intent, REQUEST_ACCESSIBILITY)
    }

    /**
     * Request screen capture permission
     */
    private fun requestScreenCapture() {
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
    }

    /**
     * Start the RemoteControlService with required parameters
     * 
     * This is a helper method that can be called when a session is initiated.
     * In a real implementation, the session ID and device token would come from
     * the backend or be configured through the UI.
     */
    private fun startRemoteControlService(sessionId: String, deviceToken: String) {
        val intent = Intent(this, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, sessionId)
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        when (requestCode) {
            REQUEST_MEDIA_PROJECTION -> {
                if (resultCode == RESULT_OK && data != null) {
                    // Permission granted, can start the service with screen capture
                    Log.i(TAG, "MediaProjection permission granted")
                    // Store result for later use when starting service
                    // In a real implementation, this would be combined with session setup
                }
            }
            REQUEST_ACCESSIBILITY -> {
                // Check if accessibility service was enabled
                if (isAccessibilityServiceEnabled()) {
                    // Service enabled
                    Log.i(TAG, "Accessibility service enabled")
                }
            }
        }
    }

    /**
     * Start the RemoteControlService with screen capture enabled.
     * 
     * This method combines WebSocket connectivity with screen capture.
     * Both the session parameters and MediaProjection permission are required.
     * 
     * @param sessionId RC session ID from backend
     * @param deviceToken Device authentication token
     * @param mediaProjectionResultCode Result code from MediaProjection permission
     * @param mediaProjectionData Intent data from MediaProjection permission
     */
    private fun startRemoteControlServiceWithCapture(
        sessionId: String,
        deviceToken: String,
        mediaProjectionResultCode: Int,
        mediaProjectionData: Intent
    ) {
        val intent = Intent(this, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, sessionId)
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_RESULT_CODE, mediaProjectionResultCode)
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_DATA, mediaProjectionData)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Log.i(TAG, "Starting RemoteControlService with screen capture")
    }
}
