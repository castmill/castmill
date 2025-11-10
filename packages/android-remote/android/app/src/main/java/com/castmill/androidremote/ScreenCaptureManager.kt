package com.castmill.androidremote

import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.HandlerThread
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import java.nio.ByteBuffer

/**
 * ScreenCaptureManager handles screen capture using MediaProjection.
 * 
 * This manager:
 * - Creates VirtualDisplay from MediaProjection
 * - Manages video encoding (H.264 or MJPEG fallback)
 * - Streams encoded frames via callback
 * - Handles lifecycle and resource cleanup
 * 
 * @param context Application context
 * @param resultCode Result code from MediaProjection permission request
 * @param data Intent data from MediaProjection permission request
 * @param onFrameEncoded Callback when a frame is encoded and ready to send
 * @param onError Callback when an error occurs
 */
class ScreenCaptureManager(
    private val context: Context,
    private val resultCode: Int,
    private val data: Intent,
    private val onFrameEncoded: (ByteBuffer, Boolean, String) -> Unit, // data, isKeyFrame, codecType
    private val onError: (Exception) -> Unit
) {
    companion object {
        private const val TAG = "ScreenCaptureManager"
        private const val DISPLAY_NAME = "CastmillScreenCapture"
        
        // Encoding parameters
        private const val TARGET_WIDTH = 1280
        private const val TARGET_HEIGHT = 720
        private const val H264_FRAME_RATE = 15
        private const val H264_BITRATE = 2_000_000 // 2 Mbps
        private const val MJPEG_FRAME_RATE = 5
        private const val MJPEG_QUALITY = 75
        
        // Drain interval for H.264 encoder (ms)
        private const val DRAIN_INTERVAL_MS = 33L // ~30fps drain rate
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var videoEncoder: VideoEncoder? = null
    private var mjpegEncoder: MjpegEncoder? = null
    private var encoderThread: HandlerThread? = null
    private var encoderHandler: Handler? = null
    private var isCapturing = false
    private var useH264 = true
    private var drainRunnable: Runnable? = null

    /**
     * Start screen capture and encoding.
     * @return true if capture started successfully, false otherwise
     */
    fun start(): Boolean {
        try {
            // Get MediaProjection
            val projectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)
            
            if (mediaProjection == null) {
                Log.e(TAG, "Failed to obtain MediaProjection")
                onError(Exception("Failed to obtain MediaProjection"))
                return false
            }

            // Register callback for projection stop
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.i(TAG, "MediaProjection stopped")
                    stop()
                }
            }, null)

            // Try H.264 encoding first, fallback to MJPEG if it fails
            val encoderStarted = if (useH264) {
                startH264Encoding()
            } else {
                startMjpegEncoding()
            }

            if (!encoderStarted) {
                Log.w(TAG, "Failed to start encoder")
                return false
            }

            isCapturing = true
            Log.i(TAG, "Screen capture started with ${if (useH264) "H.264" else "MJPEG"} encoding")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen capture", e)
            onError(e)
            return false
        }
    }

    /**
     * Start H.264 encoding with fallback to MJPEG on failure.
     */
    private fun startH264Encoding(): Boolean {
        try {
            // Create encoder thread
            encoderThread = HandlerThread("H264EncoderThread").apply {
                start()
            }
            encoderHandler = Handler(encoderThread!!.looper)

            // Create video encoder
            videoEncoder = VideoEncoder(
                width = TARGET_WIDTH,
                height = TARGET_HEIGHT,
                frameRate = H264_FRAME_RATE,
                bitrate = H264_BITRATE,
                onEncodedFrame = { buffer, bufferInfo, isKeyFrame ->
                    onFrameEncoded(buffer, isKeyFrame, "h264")
                },
                onError = { exception ->
                    Log.e(TAG, "H.264 encoder error, falling back to MJPEG", exception)
                    // Fallback to MJPEG
                    encoderHandler?.post {
                        stopH264Encoding()
                        useH264 = false
                        startMjpegEncoding()
                    }
                }
            )

            // Initialize encoder
            if (!videoEncoder!!.start()) {
                Log.w(TAG, "Failed to initialize H.264 encoder, falling back to MJPEG")
                videoEncoder = null
                useH264 = false
                return startMjpegEncoding()
            }

            // Get input surface
            val inputSurface = videoEncoder?.inputSurface
            if (inputSurface == null) {
                Log.w(TAG, "Failed to get input surface, falling back to MJPEG")
                videoEncoder?.stop()
                videoEncoder = null
                useH264 = false
                return startMjpegEncoding()
            }

            // Create virtual display
            val metrics = getDisplayMetrics()
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                DISPLAY_NAME,
                TARGET_WIDTH,
                TARGET_HEIGHT,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                inputSurface,
                null,
                encoderHandler
            )

            if (virtualDisplay == null) {
                Log.e(TAG, "Failed to create VirtualDisplay")
                videoEncoder?.stop()
                videoEncoder = null
                return false
            }

            // Start the encoder
            videoEncoder?.startEncoder()

            // Start draining encoder periodically
            drainRunnable = object : Runnable {
                override fun run() {
                    videoEncoder?.drainEncoder()
                    encoderHandler?.postDelayed(this, DRAIN_INTERVAL_MS)
                }
            }
            encoderHandler?.post(drainRunnable!!)

            Log.i(TAG, "H.264 encoding started")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting H.264 encoding, falling back to MJPEG", e)
            stopH264Encoding()
            useH264 = false
            return startMjpegEncoding()
        }
    }

    /**
     * Start MJPEG encoding as fallback.
     */
    private fun startMjpegEncoding(): Boolean {
        try {
            // Create MJPEG encoder
            mjpegEncoder = MjpegEncoder(
                width = TARGET_WIDTH,
                height = TARGET_HEIGHT,
                frameRate = MJPEG_FRAME_RATE,
                quality = MJPEG_QUALITY,
                onEncodedFrame = { buffer, timestamp, isKeyFrame ->
                    onFrameEncoded(buffer, isKeyFrame, "mjpeg")
                },
                onError = { exception ->
                    Log.e(TAG, "MJPEG encoder error", exception)
                    onError(exception)
                }
            )

            // Initialize encoder
            if (!mjpegEncoder!!.start()) {
                Log.e(TAG, "Failed to initialize MJPEG encoder")
                mjpegEncoder = null
                return false
            }

            // Get surface
            val surface = mjpegEncoder?.getSurface()
            if (surface == null) {
                Log.e(TAG, "Failed to get MJPEG surface")
                mjpegEncoder?.stop()
                mjpegEncoder = null
                return false
            }

            // Create virtual display
            val metrics = getDisplayMetrics()
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                DISPLAY_NAME,
                TARGET_WIDTH,
                TARGET_HEIGHT,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface,
                null,
                null
            )

            if (virtualDisplay == null) {
                Log.e(TAG, "Failed to create VirtualDisplay for MJPEG")
                mjpegEncoder?.stop()
                mjpegEncoder = null
                return false
            }

            Log.i(TAG, "MJPEG encoding started")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting MJPEG encoding", e)
            onError(e)
            return false
        }
    }

    /**
     * Stop H.264 encoding and clean up resources.
     */
    private fun stopH264Encoding() {
        // Stop drain runnable
        drainRunnable?.let { encoderHandler?.removeCallbacks(it) }
        drainRunnable = null

        // Stop encoder
        videoEncoder?.stop()
        videoEncoder = null

        // Stop encoder thread
        encoderThread?.quitSafely()
        encoderThread?.join()
        encoderThread = null
        encoderHandler = null
    }

    /**
     * Stop MJPEG encoding and clean up resources.
     */
    private fun stopMjpegEncoding() {
        mjpegEncoder?.stop()
        mjpegEncoder = null
    }

    /**
     * Stop screen capture and release all resources.
     */
    fun stop() {
        if (!isCapturing) return
        
        isCapturing = false
        
        try {
            // Release virtual display
            virtualDisplay?.release()
            virtualDisplay = null

            // Stop encoders
            if (useH264) {
                stopH264Encoding()
            } else {
                stopMjpegEncoding()
            }

            // Stop media projection
            mediaProjection?.stop()
            mediaProjection = null

            Log.i(TAG, "Screen capture stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping screen capture", e)
        }
    }

    /**
     * Check if screen capture is active.
     */
    fun isCapturing(): Boolean = isCapturing

    /**
     * Get current encoder type.
     */
    fun getEncoderType(): String = if (useH264) "H.264" else "MJPEG"

    /**
     * Get encoder information for debugging/monitoring.
     */
    fun getEncoderInfo(): Map<String, Any> {
        val encoderInfo = if (useH264) {
            videoEncoder?.getEncoderInfo() ?: emptyMap()
        } else {
            mjpegEncoder?.getEncoderInfo() ?: emptyMap()
        }
        
        return encoderInfo + mapOf(
            "isCapturing" to isCapturing,
            "activeEncoder" to getEncoderType()
        )
    }

    /**
     * Get display metrics for the device.
     */
    private fun getDisplayMetrics(): DisplayMetrics {
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getMetrics(metrics)
        return metrics
    }
}
