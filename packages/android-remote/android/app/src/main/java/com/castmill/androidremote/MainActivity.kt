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
import android.widget.TextView
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
    }

    private lateinit var mediaProjectionManager: MediaProjectionManager
    
    // UI elements
    private lateinit var tvDeviceId: TextView
    private lateinit var tvAccessibilityStatus: TextView
    private lateinit var tvScreenCaptureStatus: TextView
    private lateinit var tvServiceStatus: TextView
    private lateinit var btnEnableAccessibility: Button
    private lateinit var btnRequestScreenCapture: Button
    
    // Permission state
    // Note: RESULT_OK = -1 in Android, so we use a different sentinel value
    private var mediaProjectionResultCode: Int = Int.MIN_VALUE  // Sentinel for "not yet requested"
    private var mediaProjectionData: Intent? = null
    
    // Status listener for live updates
    private val statusListener: (RemoteControlService.ConnectionStatus) -> Unit = { _ ->
        // Run on main thread
        runOnUiThread {
            updateServiceStatusDisplay()
        }
    }

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
        
        // Try to start service in standby mode if device token is available
        startStandbyServiceIfPossible()
        
        // Check if launched to request MediaProjection permission (from service)
        handleMediaProjectionRequest(intent)
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        // Handle when activity is already running and receives new intent
        intent?.let { handleMediaProjectionRequest(it) }
    }
    
    /**
     * Handle request to show MediaProjection permission dialog.
     * Called when the service launches this activity to request permission.
     */
    private fun handleMediaProjectionRequest(intent: Intent) {
        if (intent.getBooleanExtra("request_media_projection", false)) {
            Log.i(TAG, "Received request to show MediaProjection permission dialog")
            // Automatically show the screen capture permission dialog
            requestScreenCapturePermission()
        }
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
                
                Log.i(TAG, "MediaProjection permission granted")
                updatePermissionStates()
                
                // Send the MediaProjection permission to the running service
                sendMediaProjectionToService(result.resultCode, result.data!!)
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
        // Register for status updates
        RemoteControlService.addStatusListener(statusListener)
    }
    
    override fun onPause() {
        super.onPause()
        // Unregister status listener
        RemoteControlService.removeStatusListener(statusListener)
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
        btnEnableAccessibility = findViewById(R.id.btnEnableAccessibility)
        btnRequestScreenCapture = findViewById(R.id.btnRequestScreenCapture)
        
        // Set up click listeners
        btnEnableAccessibility.setOnClickListener {
            showAccessibilityDialog()
        }
        
        btnRequestScreenCapture.setOnClickListener {
            showScreenCaptureDialog()
        }
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
        
        // Update service status with detailed connection state
        updateServiceStatusDisplay()
    }
    
    /**
     * Update the service status display with detailed connection state
     */
    private fun updateServiceStatusDisplay() {
        if (!RemoteControlService.isRunning) {
            tvServiceStatus.text = getString(R.string.service_status_stopped)
            tvServiceStatus.setTextColor(getColor(android.R.color.holo_orange_dark))
            return
        }
        
        // Service is running, show detailed connection status
        when (RemoteControlService.connectionStatus) {
            RemoteControlService.ConnectionStatus.NOT_RUNNING -> {
                tvServiceStatus.text = getString(R.string.service_status_stopped)
                tvServiceStatus.setTextColor(getColor(android.R.color.holo_orange_dark))
            }
            RemoteControlService.ConnectionStatus.NO_NETWORK -> {
                tvServiceStatus.text = getString(R.string.service_status_no_network)
                tvServiceStatus.setTextColor(getColor(android.R.color.holo_red_dark))
            }
            RemoteControlService.ConnectionStatus.CONNECTING -> {
                tvServiceStatus.text = getString(R.string.service_status_connecting)
                tvServiceStatus.setTextColor(getColor(android.R.color.holo_blue_dark))
            }
            RemoteControlService.ConnectionStatus.WAITING_FOR_RC -> {
                tvServiceStatus.text = getString(R.string.service_status_waiting)
                tvServiceStatus.setTextColor(getColor(android.R.color.holo_green_dark))
            }
            RemoteControlService.ConnectionStatus.RC_ACTIVE -> {
                tvServiceStatus.text = getString(R.string.service_status_rc_active)
                tvServiceStatus.setTextColor(getColor(android.R.color.holo_green_light))
            }
        }
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
     * Request screen capture permission directly without showing explanatory dialog.
     * Used when the service requests permission (user already initiated an RC session).
     */
    private fun requestScreenCapturePermission() {
        Log.i(TAG, "Auto-requesting screen capture permission (service requested)")
        requestScreenCapture()
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
     * Start the remote control service in standby mode.
     * 
     * In standby mode, the service connects to the backend using only the device's
     * hardware_id and sends periodic heartbeats to indicate the RC app is available.
     * No token is required - the server identifies the device by hardware_id.
     */
    private fun startStandbyServiceIfPossible() {
        Log.i(TAG, "Starting RC service in standby mode (using device hardware_id)")
        startRemoteControlServiceStandby()
    }

    /**
     * Send MediaProjection permission to the running service.
     * This allows the service to start screen capture when a session is started.
     */
    private fun sendMediaProjectionToService(resultCode: Int, data: Intent) {
        Log.i(TAG, "Sending MediaProjection permission to service")
        val intent = Intent(this, RemoteControlService::class.java).apply {
            action = RemoteControlService.ACTION_UPDATE_MEDIA_PROJECTION
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_RESULT_CODE, resultCode)
            putExtra(RemoteControlService.EXTRA_MEDIA_PROJECTION_DATA, data)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    /**
     * Start the RemoteControlService in standby mode (no active session)
     * 
     * Standby mode connects to the backend using only the device's hardware_id
     * and sends heartbeats to indicate the RC app is running and available.
     * No token is required for standby mode.
     */
    private fun startRemoteControlServiceStandby() {
        val intent = Intent(this, RemoteControlService::class.java)
        // No extras needed - service will use device hardware_id automatically
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Log.i(TAG, "Starting RemoteControlService in standby mode")
    }
}
