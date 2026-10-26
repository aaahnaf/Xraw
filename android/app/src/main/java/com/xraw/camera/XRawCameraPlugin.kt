package com.xraw.camera

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.camera2.*
import android.hardware.camera2.params.StreamConfigurationMap
import android.media.ImageReader
import android.media.Image
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.util.Size
import android.view.Surface
import com.getcapacitor.*
import com.xraw.camera.format.XRawWriter
import com.xraw.camera.format.XRawLCCodec
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Semaphore
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * XRAW Camera Capacitor 5 Plugin
 *
 * Bridges the React frontend to Android Camera2 API.
 * Uses @CapacitorPlugin (Capacitor 5) instead of deprecated @NativePlugin.
 */
@CapacitorPlugin(name = "XRawCamera")
class XRawCameraPlugin : Plugin() {

    companion object {
        const val TAG = "XRawCamera"
        const val MAX_FRAME_QUEUE_SIZE = 4
        const val RECOVERY_INTERVAL = 48
        const val STILL_CAPTURE_TIMEOUT_MS = 5000L
    }

    // Camera2 objects
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var previewImageReader: ImageReader? = null
    private var rawImageReader: ImageReader? = null

    // Camera characteristics
    private var cameraCharacteristics: CameraCharacteristics? = null
    private var cameraId: String = "0"

    // Threading
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var writerThread: HandlerThread? = null
    private var writerHandler: Handler? = null

    // State
    private val cameraOpenCloseLock = Semaphore(1)
    private val isRecording = AtomicBoolean(false)
    private val frameCounter = AtomicInteger(0)
    private val droppedFrameCount = AtomicInteger(0)

    // Frame queue (bounded) — stores byte arrays, NOT Image objects
    // This avoids race conditions where ImageReader closes images while writer processes them
    private val frameQueue = LinkedBlockingQueue<FrameData>(MAX_FRAME_QUEUE_SIZE)

    data class FrameData(val bytes: ByteArray, val frameIndex: Int)

    // File writer
    private var xrawWriter: XRawWriter? = null

    // Settings
    private var currentExposureTime: Long? = null
    private var currentISO: Int? = null
    private var currentWhiteBalance: Int? = null
    private var currentFocusDistance: Float? = null
    private var currentZoom: Float = 1.0f

    // Pending call for async operations
    private val pendingOpenCall = AtomicReference<PluginCall?>(null)
    private val pendingStillCall = AtomicReference<PluginCall?>(null)
    private val pendingRecordCall = AtomicReference<PluginCall?>(null)

    // Writer state
    private val writerActive = AtomicBoolean(false)

    override fun load() {
        super.load()
        startCameraThread()
        startWriterThread()
    }

    // ==================== PERMISSIONS ====================

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val result = JSONObject()
        val hasCamera = context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasStorage = if (Build.VERSION.SDK_INT >= 33) {
            context.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
        } else {
            context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }

        result.put("camera", if (hasCamera) "granted" else "prompt")
        result.put("storage", if (hasStorage) "granted" else "prompt")
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val perms = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT < 33) {
            perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        } else {
            perms.add(Manifest.permission.READ_MEDIA_IMAGES)
            perms.add(Manifest.permission.READ_MEDIA_VIDEO)
        }
        requestPermissionForPlugin(perms.toTypedArray(), call, 1001)
    }

    // ==================== CAMERA ENUMERATION ====================

    @PluginMethod
    fun enumerateCameras(call: PluginCall) {
        try {
            val manager = context.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            val cameras = JSONArray()

            for (id in manager.cameraIdList) {
                val characteristics = manager.getCameraCharacteristics(id)
                val cameraInfo = JSONObject()

                cameraInfo.put("id", id)

                // Facing direction
                val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                cameraInfo.put("facing", when (facing) {
                    CameraCharacteristics.LENS_FACING_BACK -> "back"
                    CameraCharacteristics.LENS_FACING_FRONT -> "front"
                    else -> "external"
                })

                // Hardware level
                val hwLevel = characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)
                cameraInfo.put("hardwareLevel", when (hwLevel) {
                    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "legacy"
                    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "limited"
                    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "full"
                    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> "level_3"
                    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> "external"
                    else -> "unknown"
                })

                // Capabilities
                val caps = characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) as IntArray
                val capNames = JSONArray()
                var rawSupported = false
                var manualControls = false

                for (cap in caps) {
                    when (cap) {
                        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW -> {
                            capNames.put("RAW_SENSOR")
                            rawSupported = true
                        }
                        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR -> {
                            capNames.put("MANUAL_SENSOR")
                            manualControls = true
                        }
                        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_POST_PROCESSING -> {
                            capNames.put("MANUAL_POST_PROCESSING")
                        }
                    }
                }

                cameraInfo.put("capabilities", capNames)
                cameraInfo.put("rawSupported", rawSupported)
                cameraInfo.put("manualControls", manualControls)

                // Sensor info
                val sensorRect = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                if (sensorRect != null) {
                    val sensor = JSONObject()
                    sensor.put("width", sensorRect.width())
                    sensor.put("height", sensorRect.height())

                    val physicalSize = characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
                    if (physicalSize != null) {
                        val physJson = JSONObject()
                        physJson.put("width", physicalSize.width.toDouble())
                        physJson.put("height", physicalSize.height.toDouble())
                        sensor.put("physicalSize", physJson)
                    }

                    val pixelArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
                    if (pixelArray != null) {
                        val pixJson = JSONObject()
                        pixJson.put("width", pixelArray.width)
                        pixJson.put("height", pixelArray.height)
                        sensor.put("pixelArraySize", pixJson)
                    }

                    val exposureRange = characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)
                    if (exposureRange != null) {
                        val expRange = JSONObject()
                        expRange.put("min", exposureRange.lower)
                        expRange.put("max", exposureRange.upper)
                        sensor.put("exposureTimeRange", expRange)
                    }

                    val isoRange = characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)
                    if (isoRange != null) {
                        val isoRangeJson = JSONObject()
                        isoRangeJson.put("min", isoRange.lower)
                        isoRangeJson.put("max", isoRange.upper)
                        sensor.put("sensitivityRange", isoRangeJson)
                    }

                    // FIX: CONTROL_AWB_AVAILABLE_TEMPERATURES returns Range<Integer>[] not single Range
                    try {
                        val wbRanges = characteristics.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_TEMPERATURES)
                        if (wbRanges != null && wbRanges.isNotEmpty()) {
                            // Use the widest range
                            val minK = wbRanges.minOf { it.lower }
                            val maxK = wbRanges.maxOf { it.upper }
                            val wbRangeJson = JSONObject()
                            wbRangeJson.put("min", minK)
                            wbRangeJson.put("max", maxK)
                            sensor.put("whiteBalanceRange", wbRangeJson)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not read WB temperature range", e)
                    }

                    val cfa = characteristics.get(CameraCharacteristics.SENSOR_INFO_COLOR_FILTER_ARRANGEMENT)
                    sensor.put("colorFilterArrangement", cfa ?: -1)

                    cameraInfo.put("sensorInfo", sensor)
                }

                // RAW output sizes
                val config = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                if (config != null && rawSupported) {
                    val rawSizes = config.getOutputSizes(android.graphics.ImageFormat.RAW_SENSOR)
                    if (rawSizes != null) {
                        val rawFormats = JSONArray()
                        for (size in rawSizes) {
                            val fmt = JSONObject()
                            fmt.put("width", size.width)
                            fmt.put("height", size.height)
                            val minDuration = config.getOutputMinFrameDuration(android.graphics.ImageFormat.RAW_SENSOR, size)
                            fmt.put("minFrameDurationNs", minDuration)
                            fmt.put("maxFps", if (minDuration > 0) (1000000000L / minDuration).toInt() else 0)
                            rawFormats.put(fmt)
                        }
                        cameraInfo.put("rawFormats", rawFormats)
                    }
                }

                cameras.put(cameraInfo)
            }

            val result = JSONObject()
            result.put("cameras", cameras)
            call.resolve(result)

        } catch (e: Exception) {
            call.reject("Failed to enumerate cameras: ${e.message}", e)
        }
    }

    // ==================== CAMERA OPEN/CLOSE ====================

    @PluginMethod
    fun openCamera(call: PluginCall) {
        val requestedId = call.getString("cameraId") ?: "0"

        if (!cameraOpenCloseLock.tryAcquire(2500, TimeUnit.MILLISECONDS)) {
            call.reject("Camera is busy")
            return
        }

        try {
            cameraId = requestedId
            val manager = context.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            cameraCharacteristics = manager.getCameraCharacteristics(cameraId)

            pendingOpenCall.set(call)
            manager.openCamera(cameraId, cameraStateCallback, cameraHandler)

        } catch (e: SecurityException) {
            cameraOpenCloseLock.release()
            call.reject("Camera permission not granted")
        } catch (e: CameraAccessException) {
            cameraOpenCloseLock.release()
            call.reject("Camera access error: ${e.message}")
        } catch (e: Exception) {
            cameraOpenCloseLock.release()
            call.reject("Failed to open camera: ${e.message}", e)
        }
    }

    @PluginMethod
    fun closeCamera(call: PluginCall) {
        try {
            stopRecordingInternal()
            closeCaptureSession()
            cameraDevice?.close()
            cameraDevice = null
            closePreviewReader()
            closeRawReader()
            if (cameraOpenCloseLock.availablePermits() == 0) {
                cameraOpenCloseLock.release()
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to close camera: ${e.message}", e)
        }
    }

    private fun closeCaptureSession() {
        try {
            captureSession?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing capture session", e)
        }
        captureSession = null
    }

    private fun closePreviewReader() {
        try {
            previewImageReader?.close()
        } catch (e: Exception) {}
        previewImageReader = null
    }

    private fun closeRawReader() {
        try {
            rawImageReader?.close()
        } catch (e: Exception) {}
        rawImageReader = null
    }

    // ==================== CAMERA STATE CALLBACK ====================

    private val cameraStateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            cameraDevice = camera
            if (cameraOpenCloseLock.availablePermits() == 0) {
                cameraOpenCloseLock.release()
            }
            pendingOpenCall.getAndSet(null)?.resolve()
            notifyListeners("cameraOpened", JSObject().apply { put("cameraId", cameraId) })
            Log.i(TAG, "Camera opened: $cameraId")
        }

        override fun onDisconnected(camera: CameraDevice) {
            camera.close()
            cameraDevice = null
            if (cameraOpenCloseLock.availablePermits() == 0) {
                cameraOpenCloseLock.release()
            }
            pendingOpenCall.getAndSet(null)?.reject("Camera disconnected")
            notifyListeners("cameraDisconnected", JSObject())
            Log.w(TAG, "Camera disconnected")
        }

        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            cameraDevice = null
            if (cameraOpenCloseLock.availablePermits() == 0) {
                cameraOpenCloseLock.release()
            }
            val errorMsg = when (error) {
                CameraDevice.StateCallback.ERROR_CAMERA_IN_USE -> "Camera in use"
                CameraDevice.StateCallback.ERROR_MAX_CAMERAS_IN_USE -> "Max cameras in use"
                CameraDevice.StateCallback.ERROR_CAMERA_DISABLED -> "Camera disabled"
                CameraDevice.StateCallback.ERROR_CAMERA_DEVICE -> "Camera device error"
                CameraDevice.StateCallback.ERROR_CAMERA_SERVICE -> "Camera service error"
                else -> "Unknown error: $error"
            }
            pendingOpenCall.getAndSet(null)?.reject(errorMsg)
            notifyListeners("cameraError", JSObject().apply { put("error", errorMsg) })
            Log.e(TAG, "Camera error: $errorMsg")
        }
    }

    // ==================== PREVIEW ====================

    /**
     * Start preview using a TextureView surface provided by the frontend.
     * The frontend creates a <video> or native texture and passes surface info.
     * For Capacitor, we use a native PreviewView or SurfaceTexture.
     */
    @PluginMethod
    fun startPreview(call: PluginCall) {
        val device = cameraDevice ?: run {
            call.reject("Camera not open")
            return
        }

        try {
            val chars = cameraCharacteristics!!
            val config = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?: run {
                    call.reject("No stream configuration available")
                    return
                }

            // Choose preview size - use a reasonable size for display
            val previewSizes = config.getOutputSizes(android.graphics.ImageFormat.YUV_420_888)
            val previewSize = chooseOptimalPreviewSize(previewSizes, 1280, 720)

            // Create ImageReader for preview frames
            // Using newInstance for API compatibility (Builder requires API 31+)
            previewImageReader = ImageReader.newInstance(
                previewSize.width,
                previewSize.height,
                android.graphics.ImageFormat.YUV_420_888,
                3 // maxImages
            )

            val surfaces = listOf<Surface>(previewImageReader!!.surface)

            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session

                    val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                    requestBuilder.addTarget(previewImageReader!!.surface)
                    applySettingsToRequest(requestBuilder)

                    // Set preview frame rate
                    requestBuilder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
                        android.util.Range(15, 30))

                    session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)

                    // Start forwarding preview frames to frontend
                    startPreviewFrameForwarding()

                    call.resolve()
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    call.reject("Preview configuration failed")
                }
            }, cameraHandler)

        } catch (e: CameraAccessException) {
            call.reject("Camera access error during preview: ${e.message}")
        } catch (e: Exception) {
            call.reject("Failed to start preview: ${e.message}", e)
        }
    }

    private fun startPreviewFrameForwarding() {
        previewImageReader?.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                // Send a lightweight preview event to frontend
                // We don't send full frame data — just notify that a frame is available
                // The frontend can use a native SurfaceView for actual display
                notifyListeners("previewFrame", JSObject().apply {
                    put("timestamp", System.currentTimeMillis())
                    put("width", image.width)
                    put("height", image.height)
                })
            } finally {
                image.close()
            }
        }, cameraHandler)
    }

    // ==================== RAW STILL CAPTURE ====================

    @PluginMethod
    fun captureRawStill(call: PluginCall) {
        val device = cameraDevice ?: run {
            call.reject("Camera not open")
            return
        }

        val chars = cameraCharacteristics ?: run {
            call.reject("Camera characteristics unavailable")
            return
        }

        try {
            // Check RAW support
            val caps = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) as? IntArray
            val rawSupported = caps?.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW) == true

            if (!rawSupported) {
                call.reject("RAW capture not supported on this device")
                return
            }

            // Find RAW output size
            val config = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) as StreamConfigurationMap
            val rawSizes = config.getOutputSizes(android.graphics.ImageFormat.RAW_SENSOR)

            if (rawSizes == null || rawSizes.isEmpty()) {
                call.reject("No RAW output sizes available")
                return
            }

            // Use largest RAW size
            val rawSize = rawSizes.maxByOrNull { it.width * it.height }!!

            // Stop current preview session
            closeCaptureSession()

            // Create RAW ImageReader using newInstance for compatibility
            closeRawReader()
            rawImageReader = ImageReader.newInstance(
                rawSize.width,
                rawSize.height,
                android.graphics.ImageFormat.RAW_SENSOR,
                2 // maxImages
            )

            // Store the call for async resolution
            pendingStillCall.set(call)

            rawImageReader!!.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image != null) {
                    try {
                        saveRawStill(image, rawSize)
                    } catch (e: Exception) {
                        pendingStillCall.getAndSet(null)?.reject("Failed to save RAW: ${e.message}")
                    } finally {
                        image.close()
                    }
                }
            }, cameraHandler)

            // Create capture session for still
            val surfaces = listOf<Surface>(rawImageReader!!.surface)

            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session

                    val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                    requestBuilder.addTarget(rawImageReader!!.surface)
                    applySettingsToRequest(requestBuilder)

                    session.capture(requestBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                        override fun onCaptureCompleted(
                            session: CameraCaptureSession,
                            request: CaptureRequest,
                            result: TotalCaptureResult
                        ) {
                            Log.i(TAG, "RAW still capture completed")
                            // Restore preview after still capture
                            restorePreviewAfterStill()
                        }

                        override fun onCaptureFailed(
                            session: CameraCaptureSession,
                            request: CaptureRequest,
                            failure: CameraCaptureFailure
                        ) {
                            pendingStillCall.getAndSet(null)?.reject("RAW capture failed: reason ${failure.reason}")
                            restorePreviewAfterStill()
                        }
                    }, cameraHandler)

                    // Set timeout for still capture
                    cameraHandler?.postDelayed({
                        val pending = pendingStillCall.getAndSet(null)
                        if (pending != null) {
                            pending.reject("RAW capture timed out")
                            restorePreviewAfterStill()
                        }
                    }, STILL_CAPTURE_TIMEOUT_MS)
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    pendingStillCall.getAndSet(null)?.reject("RAW capture session configuration failed")
                }
            }, cameraHandler)

        } catch (e: CameraAccessException) {
            call.reject("Camera access error: ${e.message}")
        } catch (e: Exception) {
            call.reject("RAW capture error: ${e.message}", e)
        }
    }

    private fun saveRawStill(image: Image, size: Size) {
        val timestamp = System.currentTimeMillis()
        val outputDir = File(context.getExternalFilesDir(null), "XRAW")
        outputDir.mkdirs()
        val outputFile = File(outputDir, "RAW_$timestamp.xraw")

        val writer = XRawWriter(outputFile)

        // Determine actual bit depth from image format
        val plane = image.planes[0]
        val buffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride

        // RAW_SENSOR is typically 16-bit unpacked or device-specific packed
        val bitDepth = when {
            pixelStride == 2 -> 16
            pixelStride == 1 -> {
                // Packed format — determine from buffer size
                val expectedUnpacked = size.width * size.height * 2
                if (buffer.remaining() < expectedUnpacked) 12 else 16
            }
            else -> 16
        }

        // Calculate actual data size
        val dataSize = buffer.remaining()

        // Write header with actual metadata
        // FIX: Use System.currentTimeMillis() * 1_000_000 for epoch nanoseconds
        val epochNanos = timestamp * 1_000_000L

        writer.writeHeader(
            width = size.width,
            height = size.height,
            bitDepth = bitDepth,
            sampleFormat = 0, // Bayer
            cfaPattern = getCfaPattern(),
            compressionId = 0, // Uncompressed for still
            frameCount = 1,
            frameRate = 0,
            timestampNanos = epochNanos,
            exposureTime = currentExposureTime ?: 0L,
            iso = currentISO ?: 0,
            whiteBalance = currentWhiteBalance ?: 0,
            focusDistance = ((currentFocusDistance ?: 0f) * 1000).toInt(),
            rowStride = rowStride,
            pixelStride = pixelStride
        )

        // Write actual RAW buffer data
        val data = ByteArray(dataSize)
        buffer.get(data)
        writer.writeFrame(data, frameIndex = 0)
        writer.finalizeFile()

        val result = JSONObject()
        result.put("success", true)
        result.put("filePath", outputFile.absolutePath)
        result.put("width", size.width)
        result.put("height", size.height)
        result.put("bitDepth", bitDepth)
        result.put("rowStride", rowStride)
        result.put("pixelStride", pixelStride)
        result.put("dataSize", dataSize)
        result.put("timestamp", timestamp)
        pendingStillCall.getAndSet(null)?.resolve(result)
    }

    private fun getCfaPattern(): Int {
        val cfa = cameraCharacteristics?.get(CameraCharacteristics.SENSOR_INFO_COLOR_FILTER_ARRANGEMENT)
        return cfa ?: 0 // Default RGGB
    }

    private fun restorePreviewAfterStill() {
        // Re-open preview session after still capture
        val device = cameraDevice ?: return
        closeRawReader()

        try {
            val chars = cameraCharacteristics ?: return
            val config = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return
            val previewSizes = config.getOutputSizes(android.graphics.ImageFormat.YUV_420_888)
            val previewSize = chooseOptimalPreviewSize(previewSizes, 1280, 720)

            previewImageReader = ImageReader.newInstance(
                previewSize.width, previewSize.height,
                android.graphics.ImageFormat.YUV_420_888, 3
            )

            device.createCaptureSession(listOf(previewImageReader!!.surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                        requestBuilder.addTarget(previewImageReader!!.surface)
                        applySettingsToRequest(requestBuilder)
                        session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)
                        startPreviewFrameForwarding()
                        notifyListeners("previewRestored", JSObject())
                    }
                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Failed to restore preview after still capture")
                    }
                }, cameraHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Error restoring preview", e)
        }
    }

    // ==================== VIDEO RECORDING ====================

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (isRecording.get()) {
            call.reject("Already recording")
            return
        }

        val device = cameraDevice ?: run {
            call.reject("Camera not open")
            return
        }

        val chars = cameraCharacteristics ?: run {
            call.reject("Camera characteristics unavailable")
            return
        }

        try {
            val width = call.getInt("width") ?: 1920
            val height = call.getInt("height") ?: 1080
            val fps = call.getInt("fps") ?: 24
            val useLossless = call.getBoolean("lossless") ?: true

            // Check RAW support
            val caps = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) as? IntArray
            val rawSupported = caps?.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW) == true

            if (!rawSupported) {
                call.reject("RAW recording not supported — device lacks RAW_SENSOR capability")
                return
            }

            // Find RAW output size matching requested resolution
            val config = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) as StreamConfigurationMap
            val rawSizes = config.getOutputSizes(android.graphics.ImageFormat.RAW_SENSOR)

            // Try exact match first, then closest
            val targetSize = rawSizes?.firstOrNull { it.width == width && it.height == height }
                ?: rawSizes?.minByOrNull { Math.abs(it.width - width) + Math.abs(it.height - height) }
                ?: run {
                    call.reject("No suitable RAW output size found")
                    return
                }

            // Report actual size if different from requested
            val sizeMismatch = targetSize.width != width || targetSize.height != height

            // Check minimum frame duration
            val minDuration = config.getOutputMinFrameDuration(android.graphics.ImageFormat.RAW_SENSOR, targetSize)
            val maxFps = if (minDuration > 0) (1000000000L / minDuration).toInt() else 0

            if (fps > maxFps && maxFps > 0) {
                call.reject("Requested FPS ($fps) exceeds maximum ($maxFps) for ${targetSize.width}x${targetSize.height}")
                return
            }

            // Create file
            val timestamp = System.currentTimeMillis()
            val outputDir = File(context.getExternalFilesDir(null), "XRAW")
            outputDir.mkdirs()
            val extension = if (useLossless) "xrawlc" else "xraw"
            val outputFile = File(outputDir, "REC_$timestamp.$extension")

            // Determine actual bit depth
            val bitDepth = 16 // RAW_SENSOR is typically 16-bit

            // Initialize writer
            val writer = XRawWriter(outputFile)
            val epochNanos = timestamp * 1_000_000L
            writer.writeHeader(
                width = targetSize.width,
                height = targetSize.height,
                bitDepth = bitDepth,
                sampleFormat = 0,
                cfaPattern = getCfaPattern(),
                compressionId = if (useLossless) 1 else 0,
                frameCount = 0, // streaming
                frameRate = fps * 1000,
                timestampNanos = epochNanos,
                exposureTime = currentExposureTime ?: 0L,
                iso = currentISO ?: 0,
                whiteBalance = currentWhiteBalance ?: 0,
                focusDistance = ((currentFocusDistance ?: 0f) * 1000).toInt(),
                rowStride = 0, // Will be determined per-frame
                pixelStride = 0
            )
            xrawWriter = writer

            // Stop current preview session
            closeCaptureSession()
            closePreviewReader()

            // Create RAW ImageReader using newInstance for API compatibility
            closeRawReader()
            rawImageReader = ImageReader.newInstance(
                targetSize.width,
                targetSize.height,
                android.graphics.ImageFormat.RAW_SENSOR,
                MAX_FRAME_QUEUE_SIZE + 1
            )

            // Set up image listener — copy data immediately, don't queue Image objects
            rawImageReader!!.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image != null) {
                    try {
                        if (!isRecording.get()) {
                            image.close()
                            return@setOnImageAvailableListener
                        }

                        // Copy buffer data immediately while Image is valid
                        val plane = image.planes[0]
                        val buffer = plane.buffer
                        val data = ByteArray(buffer.remaining())
                        buffer.get(data)

                        val frameIdx = frameCounter.get()

                        // Offer byte array to queue (not Image object)
                        val frameData = FrameData(data, frameIdx)
                        if (!frameQueue.offer(frameData, 50, TimeUnit.MILLISECONDS)) {
                            // Queue full — drop frame
                            droppedFrameCount.incrementAndGet()
                            notifyListeners("frameDropped", JSObject().apply {
                                put("reason", "queue_full")
                                put("totalDropped", droppedFrameCount.get())
                            })
                        }
                    } finally {
                        image.close() // Always close immediately after copying
                    }
                }
            }, cameraHandler)

            // Create capture session
            val surfaces = listOf<Surface>(rawImageReader!!.surface)

            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    isRecording.set(true)
                    frameCounter.set(0)
                    droppedFrameCount.set(0)
                    writerActive.set(true)

                    val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                    requestBuilder.addTarget(rawImageReader!!.surface)
                    applySettingsToRequest(requestBuilder)

                    // Set frame rate
                    requestBuilder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
                        android.util.Range(fps, fps))

                    session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)

                    // Start writer thread processing
                    startWriterProcessing()

                    val result = JSONObject()
                    result.put("success", true)
                    result.put("filePath", outputFile.absolutePath)
                    result.put("width", targetSize.width)
                    result.put("height", targetSize.height)
                    result.put("fps", fps)
                    result.put("maxFps", maxFps)
                    result.put("sizeMismatch", sizeMismatch)
                    result.put("lossless", useLossless)
                    result.put("bitDepth", bitDepth)
                    pendingRecordCall.getAndSet(null)?.resolve(result) ?: call.resolve(result)
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    pendingRecordCall.getAndSet(null)?.reject("Recording session configuration failed")
                        ?: call.reject("Recording session configuration failed")
                    // Clean up writer
                    try { writer.close() } catch (e: Exception) {}
                    xrawWriter = null
                }
            }, cameraHandler)

        } catch (e: CameraAccessException) {
            call.reject("Camera access error: ${e.message}")
        } catch (e: Exception) {
            call.reject("Recording error: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val status = stopRecordingInternal()
        call.resolve(status)
    }

    /**
     * Stop recording with proper lifecycle:
     * 1. Signal writer to stop accepting new frames
     * 2. Stop camera repeating request
     * 3. Drain remaining frames from queue (single-threaded)
     * 4. Finalize file
     * 5. Restore preview
     */
    private fun stopRecordingInternal(): JSONObject {
        val status = JSONObject()

        if (!isRecording.compareAndSet(true, false)) {
            status.put("wasRecording", false)
            return status
        }

        // Signal writer to stop
        writerActive.set(false)

        // Stop repeating request
        try {
            captureSession?.stopRepeating()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping repeating request", e)
        }

        // Wait for writer thread to drain queue
        // The writer loop checks writerActive and will exit
        writerHandler?.post {
            // Drain remaining frames
            drainFrameQueue()

            // Finalize file
            val writer = xrawWriter
            if (writer != null) {
                try {
                    writer.finalizeFile()
                } catch (e: Exception) {
                    Log.e(TAG, "Error finalizing file", e)
                }
            }
            xrawWriter = null

            // Close raw reader
            closeRawReader()

            // Restore preview
            restorePreviewAfterRecording()

            // Notify
            status.put("totalFrames", frameCounter.get())
            status.put("droppedFrames", droppedFrameCount.get())
            notifyListeners("recordingStopped", status)

            Log.i(TAG, "Recording stopped: ${frameCounter.get()} frames, ${droppedFrameCount.get()} dropped")
        }

        status.put("totalFrames", frameCounter.get())
        status.put("droppedFrames", droppedFrameCount.get())
        return status
    }

    private fun drainFrameQueue() {
        while (true) {
            val frameData = frameQueue.poll(10, TimeUnit.MILLISECONDS) ?: break
            try {
                processFrameData(frameData)
            } catch (e: Exception) {
                Log.e(TAG, "Error processing frame during drain", e)
            }
        }
    }

    private fun startWriterProcessing() {
        writerHandler?.post(object : Runnable {
            override fun run() {
                if (!writerActive.get()) return

                val frameData = frameQueue.poll(50, TimeUnit.MILLISECONDS)
                if (frameData != null) {
                    try {
                        processFrameData(frameData)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing frame", e)
                    }
                }

                // Re-post if still active
                if (writerActive.get()) {
                    writerHandler?.postDelayed(this, 1)
                }
            }
        })
    }

    private fun processFrameData(frameData: FrameData) {
        val writer = xrawWriter ?: return
        val frameIdx = frameCounter.getAndIncrement()

        // Apply lossless compression if the header says XRAWLC
        val dataToWrite = if (writer.compressionId == 1) {
            // Compress using XRAWLC codec
            try {
                val codec = XRawLCCodec(writer.imageWidth, writer.imageHeight, writer.bitDepth)
                // Convert byte array to short array (16-bit samples)
                val shortData = bytesToShorts(frameData.bytes)
                val compressed = codec.compress(shortData)
                compressed
            } catch (e: Exception) {
                Log.e(TAG, "Compression failed, writing uncompressed", e)
                frameData.bytes
            }
        } else {
            frameData.bytes
        }

        writer.writeFrame(dataToWrite, frameIdx)

        // Write index at recovery intervals
        if (frameIdx > 0 && frameIdx % RECOVERY_INTERVAL == 0) {
            writer.writeIndex()
        }

        // Report progress periodically
        if (frameIdx % 24 == 0) {
            notifyListeners("recordingProgress", JSObject().apply {
                put("frameCount", frameIdx)
                put("droppedFrames", droppedFrameCount.get())
                put("fileSize", writer.currentFileSize)
            })
        }
    }

    private fun bytesToShorts(bytes: ByteArray): ShortArray {
        val shorts = ShortArray(bytes.size / 2)
        for (i in shorts.indices) {
            shorts[i] = ((bytes[i * 2].toInt() and 0xFF) or
                    ((bytes[i * 2 + 1].toInt() and 0xFF) shl 8)).toShort()
        }
        return shorts
    }

    private fun restorePreviewAfterRecording() {
        val device = cameraDevice ?: return
        try {
            val chars = cameraCharacteristics ?: return
            val config = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return
            val previewSizes = config.getOutputSizes(android.graphics.ImageFormat.YUV_420_888)
            val previewSize = chooseOptimalPreviewSize(previewSizes, 1280, 720)

            closePreviewReader()
            previewImageReader = ImageReader.newInstance(
                previewSize.width, previewSize.height,
                android.graphics.ImageFormat.YUV_420_888, 3
            )

            device.createCaptureSession(listOf(previewImageReader!!.surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                        requestBuilder.addTarget(previewImageReader!!.surface)
                        applySettingsToRequest(requestBuilder)
                        session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)
                        startPreviewFrameForwarding()
                        notifyListeners("previewRestored", JSObject())
                    }
                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Failed to restore preview after recording")
                    }
                }, cameraHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Error restoring preview after recording", e)
        }
    }

    // ==================== MANUAL CONTROLS ====================

    @PluginMethod
    fun setExposure(call: PluginCall) {
        val exposureTimeNs = call.getLong("exposureTimeNs") ?: -1L

        // Clamp to supported range
        val chars = cameraCharacteristics
        if (chars != null) {
            val range = chars.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)
            if (range != null && exposureTimeNs > 0) {
                val clamped = exposureTimeNs.coerceIn(range.lower, range.upper)
                currentExposureTime = clamped
            } else {
                currentExposureTime = if (exposureTimeNs > 0) exposureTimeNs else null
            }
        } else {
            currentExposureTime = if (exposureTimeNs > 0) exposureTimeNs else null
        }

        applyCurrentSettings()

        val result = JSONObject()
        result.put("applied", currentExposureTime)
        result.put("requested", exposureTimeNs)
        call.resolve(result)
    }

    @PluginMethod
    fun setISO(call: PluginCall) {
        val iso = call.getInt("iso") ?: -1

        // Clamp to supported range
        val chars = cameraCharacteristics
        if (chars != null) {
            val range = chars.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)
            if (range != null && iso > 0) {
                currentISO = iso.coerceIn(range.lower, range.upper)
            } else {
                currentISO = if (iso > 0) iso else null
            }
        } else {
            currentISO = if (iso > 0) iso else null
        }

        applyCurrentSettings()

        val result = JSONObject()
        result.put("applied", currentISO)
        result.put("requested", iso)
        call.resolve(result)
    }

    @PluginMethod
    fun setWhiteBalance(call: PluginCall) {
        val kelvin = call.getInt("kelvin") ?: -1

        // Clamp to supported range
        val chars = cameraCharacteristics
        if (chars != null) {
            try {
                val ranges = chars.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_TEMPERATURES)
                if (ranges != null && ranges.isNotEmpty() && kelvin > 0) {
                    val minK = ranges.minOf { it.lower }
                    val maxK = ranges.maxOf { it.upper }
                    currentWhiteBalance = kelvin.coerceIn(minK, maxK)
                } else {
                    currentWhiteBalance = if (kelvin > 0) kelvin else null
                }
            } catch (e: Exception) {
                currentWhiteBalance = if (kelvin > 0) kelvin else null
            }
        } else {
            currentWhiteBalance = if (kelvin > 0) kelvin else null
        }

        applyCurrentSettings()

        val result = JSONObject()
        result.put("applied", currentWhiteBalance)
        result.put("requested", kelvin)
        call.resolve(result)
    }

    @PluginMethod
    fun setFocusDistance(call: PluginCall) {
        val distance = call.getFloat("distance") ?: -1f

        // Clamp to supported range
        val chars = cameraCharacteristics
        if (chars != null) {
            val minFocus = chars.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE) ?: 0f
            val hyperFocal = chars.get(CameraCharacteristics.LENS_INFO_HYPERFOCAL_DISTANCE) ?: 0f
            if (distance >= 0) {
                currentFocusDistance = distance.coerceIn(0f, minFocus.coerceAtLeast(hyperFocal))
            } else {
                currentFocusDistance = null
            }
        } else {
            currentFocusDistance = if (distance >= 0) distance else null
        }

        applyCurrentSettings()

        val result = JSONObject()
        result.put("applied", currentFocusDistance)
        result.put("requested", distance)
        call.resolve(result)
    }

    @PluginMethod
    fun setZoom(call: PluginCall) {
        val zoom = call.getFloat("zoom") ?: 1.0f
        currentZoom = zoom.coerceIn(1.0f, getMaxZoom())
        applyCurrentSettings()

        val result = JSONObject()
        result.put("applied", currentZoom)
        result.put("requested", zoom)
        result.put("maxZoom", getMaxZoom())
        call.resolve(result)
    }

    private fun applyCurrentSettings() {
        val session = captureSession ?: return
        val device = cameraDevice ?: return

        try {
            val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
            if (previewImageReader != null) requestBuilder.addTarget(previewImageReader!!.surface)
            if (rawImageReader != null) requestBuilder.addTarget(rawImageReader!!.surface)
            applySettingsToRequest(requestBuilder)

            session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)
        } catch (e: CameraAccessException) {
            Log.e(TAG, "Failed to apply settings", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply settings", e)
        }
    }

    private fun applySettingsToRequest(builder: CaptureRequest.Builder) {
        // Exposure
        if (currentExposureTime != null || currentISO != null) {
            builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_OFF)
            currentExposureTime?.let {
                builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, it)
            }
            currentISO?.let {
                builder.set(CaptureRequest.SENSOR_SENSITIVITY, it)
            }
        } else {
            builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
        }

        // White Balance
        if (currentWhiteBalance != null) {
            builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_OFF)
            builder.set(CaptureRequest.COLOR_CORRECTION_MODE, CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX)
            builder.set(CaptureRequest.COLOR_CORRECTION_TRANSFORM, kelvinToTransform(currentWhiteBalance!!))
        } else {
            builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_AUTO)
        }

        // Focus
        if (currentFocusDistance != null) {
            builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_OFF)
            builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, currentFocusDistance)
        } else {
            builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
        }

        // FIX: Use SCALER_CROP_REGION instead of invalid SENSOR_INFO_ACTIVE_ARRAY_SIZE
        if (currentZoom > 1.0f) {
            val sensorRect = cameraCharacteristics?.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
            if (sensorRect != null) {
                val cropWidth = (sensorRect.width() / currentZoom).toInt()
                val cropHeight = (sensorRect.height() / currentZoom).toInt()
                val left = (sensorRect.width() - cropWidth) / 2
                val top = (sensorRect.height() - cropHeight) / 2
                val cropRect = android.graphics.Rect(left, top, left + cropWidth, top + cropHeight)
                builder.set(CaptureRequest.SCALER_CROP_REGION, cropRect)
            }
        }
    }

    private fun getMaxZoom(): Float {
        val maxZoom = cameraCharacteristics?.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM)
        return maxZoom ?: 1.0f
    }

    private fun kelvinToTransform(kelvin: Int): android.hardware.camera2.params.ColorSpaceTransform {
        // Proper CIE daylight locus approximation for color temperature
        // This maps Kelvin to RGB gains using a simplified Planckian locus
        val k = kelvin.toFloat()

        // Calculate CIE xy chromaticity from temperature (Kang et al. 2002 approximation)
        val x: Float
        val y: Float

        if (k <= 4000) {
            x = (-0.2661239f * 1e9f / (k * k * k) - 0.2343589f * 1e6f / (k * k) + 0.8776956f * 1e3f / k + 0.179910f).toFloat()
        } else {
            x = (-3.0258469f * 1e9f / (k * k * k) + 2.1070379f * 1e6f / (k * k) + 0.2226347f * 1e3f / k + 0.240390f).toFloat()
        }

        if (k <= 2222) {
            y = (-1.1063814f * x * x * x - 1.34811020f * x * x + 2.18555832f * x - 0.20219683f).toFloat()
        } else if (k <= 4000) {
            y = (-0.9549476f * x * x * x - 1.37418593f * x * x + 2.09137015f * x - 0.16748867f).toFloat()
        } else {
            y = (3.0817580f * x * x * x - 5.87338670f * x * x + 3.75112997f * x - 0.37001483f).toFloat()
        }

        // Convert xy to approximate RGB gains (sRGB D65)
        // Simplified: use ratio to D65 white point (0.3127, 0.3290)
        val d65x = 0.3127f
        val d65y = 0.3290f

        val rGain = (d65y * (1 - x)) / (x * (1 - d65y))
        val bGain = (d65x * (1 - y)) / (y * (1 - d65x))

        // Normalize gains
        val maxGain = maxOf(rGain, 1.0f, bGain)
        val r = (rGain / maxGain * 10000).toInt().coerceIn(0, 10000)
        val g = 10000
        val b = (bGain / maxGain * 10000).toInt().coerceIn(0, 10000)

        return android.hardware.camera2.params.ColorSpaceTransform(
            intArrayOf(
                r, 0, 0,
                0, g, 0,
                0, 0, b
            )
        )
    }

    // ==================== DIAGNOSTICS ====================

    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        val diagnostics = JSONObject()
        diagnostics.put("cameraId", cameraId)
        diagnostics.put("isRecording", isRecording.get())
        diagnostics.put("frameCount", frameCounter.get())
        diagnostics.put("droppedFrames", droppedFrameCount.get())
        diagnostics.put("timestamp", System.currentTimeMillis())

        // Storage info
        val storageDir = context.getExternalFilesDir(null)
        if (storageDir != null) {
            diagnostics.put("storageAvailable", storageDir.freeSpace)
            diagnostics.put("storageTotal", storageDir.totalSpace)
        }

        // Thermal status (API 29+)
        if (Build.VERSION.SDK_INT >= 29) {
            val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager
            if (pm != null) {
                val thermalStatus = when (pm.currentThermalStatus) {
                    android.os.PowerManager.THERMAL_STATUS_MODERATE -> "mild"
                    android.os.PowerManager.THERMAL_STATUS_SEVERE -> "severe"
                    android.os.PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
                    else -> "normal"
                }
                diagnostics.put("thermalStatus", thermalStatus)
            } else {
                diagnostics.put("thermalStatus", "normal")
            }
        } else {
            diagnostics.put("thermalStatus", "normal")
        }

        // Camera state
        diagnostics.put("cameraOpen", cameraDevice != null)
        diagnostics.put("previewActive", previewImageReader != null)
        diagnostics.put("rawReaderActive", rawImageReader != null)

        call.resolve(diagnostics)
    }

    @PluginMethod
    fun getRecordingStatus(call: PluginCall) {
        val result = JSONObject()
        result.put("isRecording", isRecording.get())
        result.put("frameCount", frameCounter.get())
        result.put("droppedFrames", droppedFrameCount.get())
        result.put("queueSize", frameQueue.size)

        val writer = xrawWriter
        if (writer != null) {
            result.put("fileSize", writer.currentFileSize)
            result.put("filePath", writer.filePath)
        }

        call.resolve(result)
    }

    // ==================== UTILITIES ====================

    private fun startCameraThread() {
        cameraThread = HandlerThread("XRawCamera").also {
            it.start()
            cameraHandler = Handler(it.looper)
        }
    }

    private fun startWriterThread() {
        writerThread = HandlerThread("XRawWriter").also {
            it.start()
            writerHandler = Handler(it.looper)
        }
    }

    private fun stopCameraThread() {
        cameraThread?.quitSafely()
        try {
            cameraThread?.join(1000)
        } catch (e: InterruptedException) {
            Log.w(TAG, "Camera thread interrupted", e)
        }
        cameraThread = null
        cameraHandler = null
    }

    private fun stopWriterThread() {
        writerThread?.quitSafely()
        try {
            writerThread?.join(1000)
        } catch (e: InterruptedException) {
            Log.w(TAG, "Writer thread interrupted", e)
        }
        writerThread = null
        writerHandler = null
    }

    private fun chooseOptimalPreviewSize(sizes: Array<android.util.Size>?, targetW: Int, targetH: Int): android.util.Size {
        if (sizes == null || sizes.isEmpty()) return android.util.Size(targetW, targetH)
        return sizes.minByOrNull { Math.abs(it.width - targetW) + Math.abs(it.height - targetH) }
            ?: android.util.Size(targetW, targetH)
    }

    override fun handleOnDestroy() {
        stopRecordingInternal()
        try { cameraDevice?.close() } catch (e: Exception) {}
        cameraDevice = null
        closePreviewReader()
        closeRawReader()
        if (cameraOpenCloseLock.availablePermits() == 0) {
            cameraOpenCloseLock.release()
        }
        stopCameraThread()
        stopWriterThread()
        super.handleOnDestroy()
    }
}
