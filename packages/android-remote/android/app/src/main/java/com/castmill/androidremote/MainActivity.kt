package com.castmill.androidremote

import android.app.AlertDialog
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * MainActivity for Castmill Android Remote Control
 * 
 * This activity serves as the entry point and permission management UI for the remote control service.
 * It guides users through the required permission setup:
 * 
 * 1. AccessibilityService - Required for gesture injection (tap, swipe, etc.)
 *    - Must be manually enabled in Android Settings
 *    - Provides UI guidance to help users enable the service
 * 
 * 2. MediaProjection - Required for screen capture
 *    - Requested via system dialog when needed
 *    - User must grant permission each time (manual consent flow - Track 1)
 *    - Can be auto-granted via Device Owner policy (Track 2 - documented)
 * 
 * The activity displays:
 * - Device ID for identification
 * - Permission status indicators
 * - Action buttons to enable/grant permissions
 * - Service connection status
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_NAME = "castmill_remote_prefs"
        private const val PREF_MEDIA_PROJECTION_GRANTED_BEFORE = "media_projection_granted_before"
    }

    private lateinit var mediaProjectionManager: MediaProjectionManager
    
    // UI elements
    private lateinit var tvDeviceId: TextView
    private lateinit var tvAccessibilityStatus: TextView
    private lateinit var tvScreenCaptureStatus: TextView
    private lateinit var tvServiceStatus: TextView
    private lateinit var etDeviceToken: EditText
    private lateinit var btnSaveToken: Button
    private lateinit var btnEnableAccessibility: Button
    private lateinit var btnRequestScreenCapture: Button
    
    // Permission state
    // Note: RESULT_OK = -1 in Android, so we use a different sentinel value
    private var mediaProjectionResultCode: Int = Int.MIN_VALUE  // Sentinel for "not yet requested"
    private var mediaProjectionData: Intent? = null

    // Activity Result Launchers (modern replacement for startActivityForResult)
    private lateinit var mediaProjectionLauncher: ActivityResultLauncher<Intent>
    private lateinit var accessibilitySettingsLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Register activity result launchers BEFORE any UI interaction
        registerActivityResultLaunchers()
        
        // Initialize MediaProjection manager
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        
        // Initialize UI
        initializeUI()
        
        // Display device ID
        val deviceId = DeviceUtils.getDeviceId(this)
        tvDeviceId.text = deviceId
        Log.i(TAG, "Device ID: $deviceId")
        
        // Update permission states
        updatePermissionStates()
        
        // Auto-request MediaProjection permission if previously granted
        autoRequestMediaProjectionIfNeeded()
        
        // Try to start service in standby mode if device token is available
        startStandbyServiceIfPossible()
    }

    /**
     * Register Activity Result Launchers for modern permission handling
     */
    private fun registerActivityResultLaunchers() {
        // Media Projection permission launcher
        mediaProjectionLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            Log.d(TAG, "MediaProjection result: resultCode=${result.resultCode}, data=${result.data}")
            if (result.resultCode == RESULT_OK && result.data != null) {
                // Permission granted - store for potential service use
                mediaProjectionResultCode = result.resultCode
                mediaProjectionData = result.data
                
                // Mark that user has granted permission before (for auto-request on next launch)
                markMediaProjectionGranted()
                
                Log.i(TAG, "MediaProjection permission granted")
                updatePermissionStates()
            } else {
                Log.w(TAG, "MediaProjection permission denied: resultCode=${result.resultCode}")
                // User denied permission - inform them why it's needed
                AlertDialog.Builder(this)
                    .setTitle(getString(R.string.permission_required_title))
                    .setMessage(getString(R.string.screen_capture_denied_message))
                    .setPositiveButton(android.R.string.ok, null)
                    .show()
            }
        }

        // Accessibility settings launcher
        accessibilitySettingsLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { _ ->
            // Check if accessibility service was enabled after returning from settings
            updatePermissionStates()
            if (isAccessibilityServiceEnabled()) {
                Log.i(TAG, "Accessibility service enabled")
            } else {
                Log.w(TAG, "Accessibility service not enabled")
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh permission states when returning to the activity
        updatePermissionStates()
    }

    /**
     * Initialize UI elements and set up click listeners
     */
    private fun initializeUI() {
        // Find views
        tvDeviceId = findViewById(R.id.tvDeviceId)
        tvAccessibilityStatus = findViewById(R.id.tvAccessibilityStatus)
        tvScreenCaptureStatus = findViewById(R.id.tvScreenCaptureStatus)
        tvServiceStatus = findViewById(R.id.tvServiceStatus)
        etDeviceToken = findViewById(R.id.etDeviceToken)
        btnSaveToken = findViewById(R.id.btnSaveToken)
        btnEnableAccessibility = findViewById(R.id.btnEnableAccessibility)
        btnRequestScreenCapture = findViewById(R.id.btnRequestScreenCapture)
        
        // Populate token field with stored value if available
        val storedToken = getStoredDeviceToken()
        if (storedToken != null) {
            etDeviceToken.setText(storedToken)
        }
        
        // Set up click listeners
        btnSaveToken.setOnClickListener {
            saveDeviceToken()
        }
        
        btnEnableAccessibility.setOnClickListener {
            showAccessibilityDialog()
        }
        
        btnRequestScreenCapture.setOnClickListener {
            showScreenCaptureDialog()
        }
    }

    /**
     * Save device token and start standby service
     */
    private fun saveDeviceToken() {
        val token = etDeviceToken.text.toString().trim()
        if (token.isEmpty()) {
            Toast.makeText(this, getString(R.string.token_empty_error), Toast.LENGTH_SHORT).show()
            return
        }
        
        // Store token
        storeDeviceToken(token)
        
        // Start service in standby mode
        startRemoteControlServiceStandby(token)
        
        Toast.makeText(this, getString(R.string.token_saved_message), Toast.LENGTH_SHORT).show()
        Log.i(TAG, "Device token saved, starting standby service")
    }

    /**
     * Store device token in SharedPreferences
     */
    private fun storeDeviceToken(token: String) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString("device_token", token).apply()
    }

    /**
     * Update permission status displays
     */
    private fun updatePermissionStates() {
        // Check accessibility service
        val accessibilityEnabled = isAccessibilityServiceEnabled()
        if (accessibilityEnabled) {
            tvAccessibilityStatus.text = getString(R.string.status_enabled)
            tvAccessibilityStatus.contentDescription = getString(R.string.accessibility_status_enabled)
            tvAccessibilityStatus.setTextColor(getColor(android.R.color.holo_green_dark))
            btnEnableAccessibility.isEnabled = false
            btnEnableAccessibility.text = getString(R.string.status_enabled)
        } else {
            tvAccessibilityStatus.text = getString(R.string.status_disabled)
            tvAccessibilityStatus.contentDescription = getString(R.string.accessibility_status_disabled)
            tvAccessibilityStatus.setTextColor(getColor(android.R.color.holo_orange_dark))
            btnEnableAccessibility.isEnabled = true
            btnEnableAccessibility.text = getString(R.string.enable_accessibility_button)
        }
        
        // Check screen capture permission (shows granted if previously granted in this session)
        // RESULT_OK = -1 in Android, so we check that resultCode is not the sentinel value
        if (mediaProjectionResultCode == RESULT_OK && mediaProjectionData != null) {
            tvScreenCaptureStatus.text = getString(R.string.status_granted)
            tvScreenCaptureStatus.contentDescription = getString(R.string.screen_capture_status_granted)
            tvScreenCaptureStatus.setTextColor(getColor(android.R.color.holo_green_dark))
            btnRequestScreenCapture.isEnabled = false
            btnRequestScreenCapture.text = getString(R.string.status_granted)
        } else {
            tvScreenCaptureStatus.text = getString(R.string.status_not_granted)
            tvScreenCaptureStatus.contentDescription = getString(R.string.screen_capture_status_not_granted)
            tvScreenCaptureStatus.setTextColor(getColor(android.R.color.holo_orange_dark))
            btnRequestScreenCapture.isEnabled = true
            btnRequestScreenCapture.text = getString(R.string.request_screen_capture_button)
        }
        
        // Update service status (simplified for now)
        tvServiceStatus.text = getString(R.string.service_status_stopped)
    }

    /**
     * Show dialog explaining AccessibilityService and guide user to settings
     */
    private fun showAccessibilityDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.accessibility_dialog_title)
            .setMessage(R.string.accessibility_dialog_message)
            .setPositiveButton(R.string.dialog_open_settings) { _, _ ->
                openAccessibilitySettings()
            }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
    }

    /**
     * Show dialog explaining MediaProjection permission
     */
    private fun showScreenCaptureDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.screen_capture_dialog_title)
            .setMessage(R.string.screen_capture_dialog_message)
            .setPositiveButton(R.string.dialog_understand) { _, _ ->
                requestScreenCapture()
            }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
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
        accessibilitySettingsLauncher.launch(intent)
    }

    /**
     * Request screen capture permission
     * 
     * This shows the system MediaProjection permission dialog.
     * User must explicitly grant permission each time (manual consent - Track 1).
     * 
     * For managed devices with Device Owner policy (Track 2), this permission
     * can be auto-granted. See README for details on Device Owner setup.
     */
    private fun requestScreenCapture() {
        Log.d(TAG, "Requesting screen capture permission")
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        mediaProjectionLauncher.launch(captureIntent)
    }

    /**
     * Start the RemoteControlService with required parameters
     * 
     * This is a helper method that would be called when a remote control session is initiated
     * (e.g., from a push notification or backend trigger).
     * 
     * @param sessionId RC session ID from backend
     * @param deviceToken Device authentication token
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

    /**
     * Start the RemoteControlService with screen capture enabled
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

    /**
     * Try to start the remote control service in standby mode.
     * 
     * In standby mode, the service connects to the backend and sends periodic heartbeats
     * to indicate the RC app is available, but doesn't start an active session.
     * This allows the backend to know that this device can accept remote control sessions.
     * 
     * Requires a stored device token (from a previous session configuration).
     */
    private fun startStandbyServiceIfPossible() {
        val storedToken = getStoredDeviceToken()
        if (storedToken != null) {
            Log.i(TAG, "Device token found, starting RC service in standby mode")
            startRemoteControlServiceStandby(storedToken)
        } else {
            Log.i(TAG, "No device token found, cannot start standby mode. Token must be configured first.")
        }
    }

    /**
     * Start the RemoteControlService in standby mode (no active session)
     * 
     * Standby mode connects to the backend and sends heartbeats to indicate
     * the RC app is running and available for remote control sessions.
     * 
     * @param deviceToken Device authentication token
     */
    private fun startRemoteControlServiceStandby(deviceToken: String) {
        val intent = Intent(this, RemoteControlService::class.java).apply {
            // No session ID - this triggers standby mode in the service
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, deviceToken)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Log.i(TAG, "Starting RemoteControlService in standby mode")
    }

    /**
     * Get stored device token from SharedPreferences
     */
    private fun getStoredDeviceToken(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        return prefs.getString("device_token", null)
    }
    
    /**
     * Check if MediaProjection permission was granted before
     */
    private fun wasMediaProjectionGrantedBefore(): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        return prefs.getBoolean(PREF_MEDIA_PROJECTION_GRANTED_BEFORE, false)
    }
    
    /**
     * Mark that MediaProjection permission has been granted
     */
    private fun markMediaProjectionGranted() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putBoolean(PREF_MEDIA_PROJECTION_GRANTED_BEFORE, true).apply()
        Log.i(TAG, "Marked MediaProjection as previously granted")
    }
    
    /**
     * Auto-request MediaProjection permission if user granted it before
     * This minimizes user friction on subsequent app launches
     */
    private fun autoRequestMediaProjectionIfNeeded() {
        // Only auto-request if:
        // 1. User has granted permission before (stored in SharedPreferences)
        // 2. Permission is not already granted in this session
        if (wasMediaProjectionGrantedBefore() && 
            (mediaProjectionResultCode != RESULT_OK || mediaProjectionData == null)) {
            Log.i(TAG, "Auto-requesting MediaProjection permission (previously granted)")
            // Small delay to ensure UI is ready
            tvScreenCaptureStatus.postDelayed({
                requestScreenCapture()
            }, 500)
        }
    }
}
