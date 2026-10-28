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
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.xraw.camera.format.XRawWriter
import com.xraw.camera.format.MlvWriter
import com.xraw.camera.video.LogVideoEncoder
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
 */
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
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
    private val frameQueue = LinkedBlockingQueue<FrameData>(MAX_FRAME_QUEUE_SIZE)

    data class FrameData(val bytes: ByteArray, val frameIndex: Int)

    // File writers
    private var xrawWriter: XRawWriter? = null
    private var mlvWriter: MlvWriter? = null
    private var logVideoEncoder: LogVideoEncoder? = null

    // Settings
    private var currentExposureTime: Long? = null
    private var currentISO: Int? = null
    private var currentWhiteBalance: Int? = null
    private var currentFocusDistance: Float? = null
    private var currentZoom: Float = 1.0f

    // Pending call for async operations
    private val pendingOpenCall = AtomicReference<PluginCall?>(null)
    private val pendingStillCall = AtomicReference<PluginCall?>(null)

    // Writer state
    private val writerActive = AtomicBoolean(false)

    override fun load() {
        super.load()
        startCameraThread()
        startWriterThread()
    }

    // ==================== PERMISSIONS ====================

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val result = JSObject()
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
    override fun requestPermissions(call: PluginCall) {
        // Use Android's native permission request mechanism
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
        
        activity.requestPermissions(perms.toTypedArray(), 1001)
        call.resolve()
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

                    // White balance temperature range - use standard range
                    try {
                        val wbRangeJson = JSONObject()
                        wbRangeJson.put("min", 2000)
                        wbRangeJson.put("max", 8000)
                        sensor.put("whiteBalanceRange", wbRangeJson)
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not set WB temperature range", e)
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

            val result = JSObject()
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

            // Choose preview size
            val previewSizes = config.getOutputSizes(android.graphics.ImageFormat.YUV_420_888)
            val previewSize = chooseOptimalPreviewSize(previewSizes, 1280, 720)

            previewImageReader = ImageReader.newInstance(
                previewSize.width,
                previewSize.height,
                android.graphics.ImageFormat.YUV_420_888,
                3
            )

            val surfaces = listOf<Surface>(previewImageReader!!.surface)

            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session

                    val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                    requestBuilder.addTarget(previewImageReader!!.surface)
                    applySettingsToRequest(requestBuilder)

                    requestBuilder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
                        android.util.Range(15, 30))

                    session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)

                    notifyListeners("previewStarted", JSObject().apply {
                        put("success", true)
                    })

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

    // ==================== MANUAL CONTROLS ====================

    @PluginMethod
    fun setExposure(call: PluginCall) {
        val exposureTimeNs = call.getLong("exposureTimeNs") ?: -1L

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

        val result = JSObject()
        result.put("applied", currentExposureTime)
        result.put("requested", exposureTimeNs)
        call.resolve(result)
    }

    @PluginMethod
    fun setISO(call: PluginCall) {
        val iso = call.getInt("iso") ?: -1

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

        val result = JSObject()
        result.put("applied", currentISO)
        result.put("requested", iso)
        call.resolve(result)
    }

    @PluginMethod
    fun setWhiteBalance(call: PluginCall) {
        val kelvin = call.getInt("kelvin") ?: -1

        currentWhiteBalance = if (kelvin > 0) kelvin.coerceIn(2000, 8000) else null

        applyCurrentSettings()

        val result = JSObject()
        result.put("applied", currentWhiteBalance)
        result.put("requested", kelvin)
        call.resolve(result)
    }

    @PluginMethod
    fun setFocusDistance(call: PluginCall) {
        val distance = call.getFloat("distance") ?: -1f

        currentFocusDistance = if (distance >= 0) distance else null

        applyCurrentSettings()

        val result = JSObject()
        result.put("applied", currentFocusDistance)
        result.put("requested", distance)
        call.resolve(result)
    }

    @PluginMethod
    fun setZoom(call: PluginCall) {
        val zoom = call.getFloat("zoom") ?: 1.0f
        currentZoom = zoom.coerceIn(1.0f, getMaxZoom())
        applyCurrentSettings()

        val result = JSObject()
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

        if (currentWhiteBalance != null) {
            builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_OFF)
            builder.set(CaptureRequest.COLOR_CORRECTION_MODE, CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX)
            builder.set(CaptureRequest.COLOR_CORRECTION_TRANSFORM, kelvinToTransform(currentWhiteBalance!!))
        } else {
            builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_AUTO)
        }

        if (currentFocusDistance != null) {
            builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_OFF)
            builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, currentFocusDistance)
        } else {
            builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
        }

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
        val k = kelvin.toFloat()
        val r = if (k <= 4000) 1.2f else if (k <= 5500) 1.0f else 0.9f
        val b = if (k <= 4000) 0.8f else if (k <= 5500) 1.0f else 1.3f

        return android.hardware.camera2.params.ColorSpaceTransform(
            intArrayOf(
                (r * 10000).toInt(), 0, 0,
                0, 10000, 0,
                0, 0, (b * 10000).toInt()
            )
        )
    }

    // ==================== RECORDING ====================

    @PluginMethod
    fun captureRawStill(call: PluginCall) {
        call.reject("RAW still capture not yet implemented in simplified plugin")
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        call.reject("Recording not yet implemented in simplified plugin")
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val result = JSObject()
        result.put("totalFrames", 0)
        result.put("droppedFrames", 0)
        call.resolve(result)
    }

    @PluginMethod
    fun startLogVideoRecording(call: PluginCall) {
        call.reject("Log video recording not yet implemented in simplified plugin")
    }

    @PluginMethod
    fun startMlvRecording(call: PluginCall) {
        call.reject("MLV recording not yet implemented in simplified plugin")
    }

    @PluginMethod
    fun stopLogVideoRecording(call: PluginCall) {
        val result = JSObject()
        result.put("totalFrames", 0)
        result.put("droppedFrames", 0)
        result.put("measuredFps", 0.0)
        call.resolve(result)
    }

    @PluginMethod
    fun setPreviewFrameRate(call: PluginCall) {
        val fps = call.getInt("fps") ?: 30
        val result = JSObject()
        result.put("applied", fps)
        result.put("requested", fps)
        call.resolve(result)
    }

    // ==================== DIAGNOSTICS ====================

    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        val diagnostics = JSObject()
        diagnostics.put("cameraId", cameraId)
        diagnostics.put("isRecording", isRecording.get())
        diagnostics.put("frameCount", frameCounter.get())
        diagnostics.put("droppedFrames", droppedFrameCount.get())
        diagnostics.put("timestamp", System.currentTimeMillis())

        val storageDir = context.getExternalFilesDir(null)
        if (storageDir != null) {
            diagnostics.put("storageAvailable", storageDir.freeSpace)
            diagnostics.put("storageTotal", storageDir.totalSpace)
        }

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

        diagnostics.put("cameraOpen", cameraDevice != null)
        diagnostics.put("previewActive", previewImageReader != null)
        diagnostics.put("rawReaderActive", rawImageReader != null)

        call.resolve(diagnostics)
    }

    @PluginMethod
    fun getRecordingStatus(call: PluginCall) {
        val result = JSObject()
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

    private fun stopRecordingInternal(): JSObject {
        val status = JSObject()

        if (!isRecording.compareAndSet(true, false)) {
            status.put("wasRecording", false)
            return status
        }

        writerActive.set(false)

        try {
            captureSession?.stopRepeating()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping repeating request", e)
        }

        writerHandler?.post {
            drainFrameQueue()

            val writer = xrawWriter
            val mlv = mlvWriter
            if (writer != null) {
                try {
                    writer.finalizeFile()
                } catch (e: Exception) {
                    Log.e(TAG, "Error finalizing XRAW file", e)
                }
            }
            if (mlv != null) {
                try {
                    mlv.finalizeFile()
                } catch (e: Exception) {
                    Log.e(TAG, "Error finalizing MLV file", e)
                }
            }
            xrawWriter = null
            mlvWriter = null

            closeRawReader()
            restorePreviewAfterRecording()

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
                // Process frame if needed
            } catch (e: Exception) {
                Log.e(TAG, "Error processing frame during drain", e)
            }
        }
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
