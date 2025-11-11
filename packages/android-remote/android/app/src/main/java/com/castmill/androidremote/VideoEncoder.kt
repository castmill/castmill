package com.castmill.androidremote

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.util.Log
import android.view.Surface
import java.nio.ByteBuffer

/**
 * VideoEncoder handles H.264/AVC video encoding using MediaCodec.
 * 
 * Specifications:
 * - Codec: H.264/AVC, baseline profile, level 3.1
 * - Resolution: 720p (1280x720)
 * - Frame rate: 10-15 fps
 * - Bitrate: 1.5-3 Mbps (CBR)
 * - Keyframe interval: ~2 seconds
 * - Output: NAL units in binary frames
 * 
 * @param width Video width (default: 1280)
 * @param height Video height (default: 720)
 * @param frameRate Target frame rate (default: 15)
 * @param bitrate Target bitrate in bps (default: 2_000_000 = 2 Mbps)
 * @param keyFrameInterval Keyframe interval in seconds (default: 2)
 * @param onEncodedFrame Callback when a frame is encoded with NAL unit data
 * @param onError Callback when an error occurs
 */
class VideoEncoder(
    private val width: Int = 1280,
    private val height: Int = 720,
    private val frameRate: Int = 15,
    private val bitrate: Int = 2_000_000,
    private val keyFrameInterval: Int = 2,
    private val onEncodedFrame: (ByteBuffer, MediaCodec.BufferInfo, Boolean) -> Unit,
    private val onError: (Exception) -> Unit
) {
    companion object {
        private const val TAG = "VideoEncoder"
        private const val MIME_TYPE = MediaFormat.MIMETYPE_VIDEO_AVC
        private const val TIMEOUT_USEC = 10000L // 10ms
    }

    private var mediaCodec: MediaCodec? = null
    private var inputSurfaceField: Surface? = null
    private var isEncoding = false

    /**
     * Get the input Surface for rendering frames to encode.
     * This surface should be used as the target for MediaProjection's VirtualDisplay.
     */
    val inputSurface: Surface?
        get() = inputSurfaceField

    /**
     * Initialize and start the encoder.
     * @return true if initialization was successful, false otherwise
     */
    fun start(): Boolean {
        try {
            // Create video format
            val format = MediaFormat.createVideoFormat(MIME_TYPE, width, height).apply {
                // Color format - surface input
                setInteger(
                    MediaFormat.KEY_COLOR_FORMAT,
                    MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
                )
                
                // Bitrate settings
                setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
                setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
                
                // Frame rate
                setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
                
                // Keyframe interval (I-frame interval)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, keyFrameInterval)
                
                // Profile and level
                setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
                setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel31)
                
                // Additional settings for low latency
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 0)
                setInteger(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 1_000_000 / frameRate)
            }

            // Create and configure encoder
            mediaCodec = MediaCodec.createEncoderByType(MIME_TYPE).apply {
                configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                inputSurfaceField = createInputSurface()
            }

            Log.i(TAG, "VideoEncoder initialized: ${width}x${height} @ ${frameRate}fps, ${bitrate / 1_000_000}Mbps")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize VideoEncoder", e)
            onError(e)
            return false
        }
    }

    /**
     * Start the MediaCodec encoder.
     * Call this after getting the input surface and setting up VirtualDisplay.
     */
    fun startEncoder() {
        try {
            mediaCodec?.start()
            isEncoding = true
            Log.i(TAG, "MediaCodec encoder started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start MediaCodec", e)
            onError(e)
        }
    }

    /**
     * Drain encoded data from the encoder.
     * Should be called periodically to retrieve encoded frames.
     */
    fun drainEncoder() {
        if (!isEncoding) return

        try {
            val codec = mediaCodec ?: return
            val bufferInfo = MediaCodec.BufferInfo()

            while (true) {
                val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, TIMEOUT_USEC)

                when {
                    outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                        // No output available yet
                        break
                    }
                    outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        // Format changed - log for debugging
                        val newFormat = codec.outputFormat
                        Log.d(TAG, "Encoder output format changed: $newFormat")
                    }
                    outputBufferIndex >= 0 -> {
                        // Get encoded data
                        val encodedData = codec.getOutputBuffer(outputBufferIndex)
                        
                        if (encodedData != null) {
                            // Check if this is a keyframe (SPS/PPS or IDR frame)
                            val isKeyFrame = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0
                            
                            if (bufferInfo.size > 0) {
                                // Position the buffer correctly
                                encodedData.position(bufferInfo.offset)
                                encodedData.limit(bufferInfo.offset + bufferInfo.size)
                                
                                // Create a copy of the buffer to pass to callback
                                val data = ByteArray(bufferInfo.size)
                                encodedData.get(data)
                                val nalBuffer = ByteBuffer.wrap(data)
                                
                                // Send to callback
                                onEncodedFrame(nalBuffer, bufferInfo, isKeyFrame)
                            }
                        }
                        
                        // Release the buffer back to the codec
                        codec.releaseOutputBuffer(outputBufferIndex, false)
                        
                        // Check for end of stream
                        if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            Log.i(TAG, "End of stream reached")
                            break
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error draining encoder", e)
            onError(e)
        }
    }

    /**
     * Stop the encoder and release resources.
     */
    fun stop() {
        isEncoding = false
        
        try {
            mediaCodec?.let { codec ->
                try {
                    codec.stop()
                    Log.i(TAG, "MediaCodec stopped")
                } catch (e: Exception) {
                    Log.w(TAG, "Error stopping MediaCodec", e)
                }
                
                try {
                    codec.release()
                    Log.i(TAG, "MediaCodec released")
                } catch (e: Exception) {
                    Log.w(TAG, "Error releasing MediaCodec", e)
                }
            }
        } finally {
            mediaCodec = null
            inputSurfaceField = null
        }
    }

    /**
     * Check if the encoder is currently encoding.
     */
    fun isEncoding(): Boolean = isEncoding

    /**
     * Get encoder information for debugging/monitoring.
     */
    fun getEncoderInfo(): Map<String, Any> {
        return mapOf(
            "codec" to MIME_TYPE,
            "width" to width,
            "height" to height,
            "frameRate" to frameRate,
            "bitrate" to bitrate,
            "keyFrameInterval" to keyFrameInterval,
            "isEncoding" to isEncoding
        )
    }
}
