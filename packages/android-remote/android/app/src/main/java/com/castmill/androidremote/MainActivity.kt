package com.castmill.androidremote

import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        when (requestCode) {
            REQUEST_MEDIA_PROJECTION -> {
                if (resultCode == RESULT_OK && data != null) {
                    // Permission granted, can start the service
                    // TODO: Start RemoteControlService with the result
                }
            }
            REQUEST_ACCESSIBILITY -> {
                // Check if accessibility service was enabled
                if (isAccessibilityServiceEnabled()) {
                    // Service enabled
                }
            }
        }
    }
}
