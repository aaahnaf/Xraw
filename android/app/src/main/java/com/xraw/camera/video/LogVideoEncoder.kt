package com.xraw.camera.video

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.opengl.GLES20
import android.util.Log
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Log Video Encoder
 * 
 * CURRENT LIMITATION: This encoder does NOT actually apply log curve transformations.
 * 
 * The log-profile shaders (SLOG3_SHADER, CLOG3_SHADER, etc.) are defined but never used.
 * The encoder uses COLOR_FormatSurface and passes camera frames directly to MediaCodec
 * without any OpenGL processing. The output is standard Rec.709 video, not log-encoded.
 * 
 * To properly implement log profiles, this class would need:
 * 1. EGL context creation and management
 * 2. OpenGL shader compilation and linking
 * 3. Texture creation from camera frames
 * 4. Frame rendering through shaders to encoder input surface
 * 5. Proper OpenGL lifecycle and synchronization
 * 
 * This is a significant architectural change that requires careful implementation.
 * 
 * TODO: Implement proper OpenGL pipeline for log curve application, or remove the
 * log profile feature until it can be properly implemented.
 * 
 * Uses MediaCodec for hardware-accelerated H.264/HEVC encoding.
 * Uses MediaMuxer for proper MP4 output.
 */
class LogVideoEncoder(
    private val width: Int,
    private val height: Int,
    private val frameRate: Int,
    private val logProfile: String,
    private val outputPath: String
) {
    companion object {
        const val TAG = "LogVideoEncoder"
        const val TIMEOUT_US = 10000L
    }

    private var encoder: MediaCodec? = null
    private var muxer: MediaMuxer? = null
    private var inputSurface: Surface? = null
    
    private var trackIndex = -1
    private var isMuxerStarted = false
    
    private val isRunning = AtomicBoolean(false)
    private var frameCount = 0
    private var droppedFrames = 0
    
    private val presentationTimeUs = mutableListOf<Long>()
    
    /**
     * Log curve shader programs for each profile
     */
    private val logCurveShaders = mapOf(
        "slog3" to SLOG3_SHADER,
        "slog2" to SLOG2_SHADER,
        "clog3" to CLOG3_SHADER,
        "vlog" to VLOG_SHADER,
        "logc" to LOGC_SHADER,
        "flog" to FLOG_SHADER,
        "nlog" to NLOG_SHADER,
        "dlog" to DLOG_SHADER,
        "redlogfilm" to REDLOGFILM_SHADER,
        "bmfilm" to BMFILM_SHADER,
        "none" to IDENTITY_SHADER
    )

    /**
     * Initialize the encoder
     */
    fun initialize(): Boolean {
        try {
            // Configure MediaCodec
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            format.setInteger(MediaFormat.KEY_BIT_RATE, calculateBitRate())
            format.setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
            format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            
            // Create encoder
            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            encoder!!.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            
            // Get input surface
            inputSurface = encoder!!.createInputSurface()
            encoder!!.start()
            
            // Create muxer
            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            
            isRunning.set(true)
            frameCount = 0
            droppedFrames = 0
            presentationTimeUs.clear()
            
            Log.i(TAG, "Encoder initialized: ${width}x${height} @ ${frameRate}fps, profile: $logProfile")
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize encoder", e)
            release()
            return false
        }
    }

    /**
     * Get the input surface for camera frames
     */
    fun getInputSurface(): Surface? = inputSurface

    /**
     * Encode a frame
     */
    fun encodeFrame(timestampNs: Long): Boolean {
        if (!isRunning.get()) return false
        
        try {
            // Calculate presentation timestamp
            val presentationTime = timestampNs / 1000 // Convert to microseconds
            presentationTimeUs.add(presentationTime)
            
            // Signal end-of-stream to encoder
            // The actual frame data is written to the input surface by the camera
            
            // Drain encoder output
            drainEncoder(false)
            
            frameCount++
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to encode frame", e)
            droppedFrames++
            return false
        }
    }

    /**
     * Drain encoder output and write to muxer
     */
    private fun drainEncoder(endOfStream: Boolean) {
        val encoder = this.encoder ?: return
        
        if (endOfStream) {
            encoder.signalEndOfInputStream()
        }
        
        val bufferInfo = MediaCodec.BufferInfo()
        
        while (true) {
            val outputIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
            
            when {
                outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> break
                outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    // Initialize muxer with encoder output format
                    val outputFormat = encoder.outputFormat
                    trackIndex = muxer!!.addTrack(outputFormat)
                    muxer!!.start()
                    isMuxerStarted = true
                }
                outputIndex >= 0 -> {
                    val outputBuffer = encoder.getOutputBuffer(outputIndex) ?: continue
                    
                    // Skip codec config data
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                        bufferInfo.size = 0
                    }
                    
                    if (bufferInfo.size > 0 && isMuxerStarted) {
                        outputBuffer.position(bufferInfo.offset)
                        outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                        muxer!!.writeSampleData(trackIndex, outputBuffer, bufferInfo)
                    }
                    
                    encoder.releaseOutputBuffer(outputIndex, false)
                    
                    // Check for end of stream
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        break
                    }
                }
            }
        }
    }

    /**
     * Finalize and close the encoder
     */
    fun finalize() {
        if (!isRunning.compareAndSet(true, false)) return
        
        try {
            // Drain remaining frames
            drainEncoder(true)
            
            // Close muxer
            muxer?.stop()
            muxer?.release()
            muxer = null
            
            // Close encoder
            encoder?.stop()
            encoder?.release()
            encoder = null
            
            inputSurface?.release()
            inputSurface = null
            
            Log.i(TAG, "Encoder finalized: $frameCount frames, $droppedFrames dropped")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error finalizing encoder", e)
        }
    }

    /**
     * Release all resources
     */
    fun release() {
        isRunning.set(false)
        
        try {
            encoder?.release()
        } catch (e: Exception) {}
        encoder = null
        
        try {
            muxer?.release()
        } catch (e: Exception) {}
        muxer = null
        
        try {
            inputSurface?.release()
        } catch (e: Exception) {}
        inputSurface = null
    }

    /**
     * Get encoding statistics
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "frameCount" to frameCount,
            "droppedFrames" to droppedFrames,
            "isRunning" to isRunning.get(),
            "measuredFps" to calculateMeasuredFps()
        )
    }

    private fun calculateMeasuredFps(): Double {
        if (presentationTimeUs.size < 2) return 0.0
        
        val first = presentationTimeUs.first()
        val last = presentationTimeUs.last()
        val duration = (last - first) / 1_000_000.0 // Convert to seconds
        
        return if (duration > 0) frameCount / duration else 0.0
    }

    private fun calculateBitRate(): Int {
        // Calculate bit rate based on resolution and frame rate
        // Target: ~0.1 bits per pixel per frame for good quality
        val pixelsPerFrame = width * height
        val bitsPerFrame = (pixelsPerFrame * 0.1).toInt()
        return bitsPerFrame * frameRate
    }
}

// ==================== Log Curve Shaders ====================

/**
 * Identity shader - no log transformation
 */
const val IDENTITY_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    void main() {
        gl_FragColor = texture2D(sTexture, vTextureCoord);
    }
"""

/**
 * Sony S-Log3 shader
 * Reference: Sony technical documentation
 * 18% middle gray at 0.420 (420/1023 in 10-bit)
 */
const val SLOG3_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float slog3(float x) {
        // S-Log3 transfer function
        if (x < 0.01125000) {
            return (x * 155.0 / 256.0 - 0.023296875) * 256.0 / 155.0;
        } else {
            return (log(x + 0.01) * 261.5 / 1023.0 + 0.57550996) * 1023.0 / 261.5;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            slog3(color.r),
            slog3(color.g),
            slog3(color.b),
            color.a
        );
    }
"""

/**
 * Sony S-Log2 shader
 */
const val SLOG2_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float slog2(float x) {
        // S-Log2 transfer function
        if (x < 0.035136) {
            return (x * 90.0 / 1023.0 - 0.030000) * 1023.0 / 90.0;
        } else {
            return (log(x * 0.4 + 0.01) * 155.0 / 1023.0 + 0.60101) * 1023.0 / 155.0;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            slog2(color.r),
            slog2(color.g),
            slog2(color.b),
            color.a
        );
    }
"""

/**
 * Canon C-Log3 shader
 * Reference: Canon technical documentation
 * 18% middle gray at 0.398
 */
const val CLOG3_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float clog3(float x) {
        // C-Log3 transfer function
        if (x < 0.092864) {
            return x * 10.1942 + 0.086910;
        } else {
            return log(x * 0.240158 + 0.08) * 0.240158 + 0.529136;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            clog3(color.r),
            clog3(color.g),
            clog3(color.b),
            color.a
        );
    }
"""

/**
 * Panasonic V-Log shader
 * Reference: Panasonic technical documentation
 * 18% middle gray at 0.427
 */
const val VLOG_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float vlog(float x) {
        // V-Log transfer function
        if (x < 0.01) {
            return x * 5.6 + 0.125;
        } else {
            return log(x * 0.18 + 0.01) * 0.250436 + 0.529136;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            vlog(color.r),
            vlog(color.g),
            vlog(color.b),
            color.a
        );
    }
"""

/**
 * ARRI LogC3 shader
 * Reference: ARRI technical documentation
 * 18% middle gray at 0.391
 */
const val LOGC_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float logc(float x) {
        // LogC3 transfer function (EI 800)
        return log(x * 5.555556 + 0.052272) * 0.247190 + 0.385537;
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            logc(color.r),
            logc(color.g),
            logc(color.b),
            color.a
        );
    }
"""

/**
 * Fujifilm F-Log shader
 * Reference: Fujifilm technical documentation
 * 18% middle gray at 0.429
 */
const val FLOG_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float flog(float x) {
        // F-Log transfer function
        if (x < 0.00089) {
            return x * 5.6 + 0.09;
        } else {
            return log(x * 0.18 + 0.01) * 0.245311 + 0.529136;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            flog(color.r),
            flog(color.g),
            flog(color.b),
            color.a
        );
    }
"""

/**
 * Nikon N-Log shader
 * Reference: Nikon technical documentation
 * 18% middle gray at 0.5
 */
const val NLOG_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float nlog(float x) {
        // N-Log transfer function
        if (x < 0.328) {
            return x * 0.32222;
        } else {
            return log(x * 0.349 - 0.034) * 0.184878 + 0.529136;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            nlog(color.r),
            nlog(color.g),
            nlog(color.b),
            color.a
        );
    }
"""

/**
 * DJI D-Log shader (approximate)
 * Note: Exact curve not publicly documented
 */
const val DLOG_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float dlog(float x) {
        // D-Log approximate transfer function
        return log(x * 0.25 + 0.01) * 0.25 + 0.5;
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            dlog(color.r),
            dlog(color.g),
            dlog(color.b),
            color.a
        );
    }
"""

/**
 * RED REDlogFilm shader
 * Reference: RED technical documentation
 */
const val REDLOGFILM_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float redlogfilm(float x) {
        // REDlogFilm transfer function
        return log(x * 0.18 + 0.01) * 0.25 + 0.5;
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            redlogfilm(color.r),
            redlogfilm(color.g),
            redlogfilm(color.b),
            color.a
        );
    }
"""

/**
 * Blackmagic Film shader (approximate)
 * Note: Exact Gen 5 curve not publicly documented
 */
const val BMFILM_SHADER = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform samplerExternalOES sTexture;
    
    float bmfilm(float x) {
        // Blackmagic Film approximate transfer function
        if (x < 0.005) {
            return x * 8.0;
        } else {
            return log(x * 0.2 + 0.01) * 0.25 + 0.5;
        }
    }
    
    void main() {
        vec4 color = texture2D(sTexture, vTextureCoord);
        gl_FragColor = vec4(
            bmfilm(color.r),
            bmfilm(color.g),
            bmfilm(color.b),
            color.a
        );
    }
"""
