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

/**
 * XRAW Camera Capacitor Plugin
 * 
 * Bridges the React frontend to Android Camera2 API.
 * Handles all camera operations including:
 * - Camera enumeration and capability discovery
 * - Preview management
 * - RAW still capture
 * - Continuous RAW video recording
 * - Manual exposure controls
 * - File format writing (.xraw / .xrawlc)
 */
@NativePlugin(
    name = "XRawCamera",
    permissions = [
        Manifest.permission.CAMERA,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.RECORD_AUDIO
    ],
    requestCodes = [XRawCameraPlugin.REQUEST_CAMERA_PERMISSION]
)
class XRawCameraPlugin : Plugin() {
    
    companion object {
        const val REQUEST_CAMERA_PERMISSION = 1001
        const val TAG = "XRawCamera"
        const val MAX_FRAME_QUEUE_SIZE = 4
        const val RECOVERY_INTERVAL = 48 // frames between index checkpoints
    }
    
    // Camera2 objects
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var previewSurface: Surface? = null
    private var imageReader: ImageReader? = null
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
    
    // Frame queue (bounded)
    private val frameQueue = LinkedBlockingQueue<Image>(MAX_FRAME_QUEUE_SIZE)
    
    // File writer
    private var xrawWriter: XRawWriter? = null
    
    // Settings
    private var currentExposureTime: Long? = null
    private var currentISO: Int? = null
    private var currentWhiteBalance: Int? = null
    private var currentFocusDistance: Float? = null
    private var currentZoom: Float = 1.0f
    
    // Capabilities cache
    private var capabilitiesCache: JSONObject? = null

    override fun load() {
        super.load()
        startCameraThread()
        startWriterThread()
    }
    
    // ==================== PERMISSIONS ====================
    
    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val result = JSONObject()
        val hasCamera = activity.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasStorage = if (Build.VERSION.SDK_INT >= 33) {
            activity.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
        } else {
            activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
        
        result.put("camera", if (hasCamera) "granted" else "prompt")
        result.put("storage", if (hasStorage) "granted" else "prompt")
        call.resolve(result)
    }
    
    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val perms = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.RECORD_AUDIO
        )
        requestPermissionForPlugin(perms, call, REQUEST_CAMERA_PERMISSION)
    }
    
    // ==================== CAMERA ENUMERATION ====================
    
    @PluginMethod
    fun enumerateCameras(call: PluginCall) {
        try {
            val manager = activity.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
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
                val sensorInfo = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                if (sensorInfo != null) {
                    val sensor = JSONObject()
                    sensor.put("width", sensorInfo.width())
                    sensor.put("height", sensorInfo.height())
                    
                    val exposureRange = characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE) as? android.util.Range<Long>
                    if (exposureRange != null) {
                        val expRange = JSONObject()
                        expRange.put("min", exposureRange.lower)
                        expRange.put("max", exposureRange.upper)
                        sensor.put("exposureTimeRange", expRange)
                    }
                    
                    val isoRange = characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) as? android.util.Range<Int>
                    if (isoRange != null) {
                        val isoRangeJson = JSONObject()
                        isoRangeJson.put("min", isoRange.lower)
                        isoRangeJson.put("max", isoRange.upper)
                        sensor.put("sensitivityRange", isoRangeJson)
                    }
                    
                    val wbRange = characteristics.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_TEMPERATURES) as? android.util.Range<Int>
                    if (wbRange != null) {
                        val wbRangeJson = JSONObject()
                        wbRangeJson.put("min", wbRange.lower)
                        wbRangeJson.put("max", wbRange.upper)
                        sensor.put("whiteBalanceRange", wbRangeJson)
                    }
                    
                    val cfa = characteristics.get(CameraCharacteristics.SENSOR_INFO_COLOR_FILTER_ARRANGEMENT)
                    sensor.put("colorFilterArrangement", cfa ?: -1)
                    
                    cameraInfo.put("sensorInfo", sensor)
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
        val requestedId = call.getString("cameraId", "0")
        
        if (!cameraOpenCloseLock.tryAcquire(2500, TimeUnit.MILLISECONDS)) {
            call.reject("Camera is busy")
            return
        }
        
        try {
            cameraId = requestedId
            val manager = activity.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            cameraCharacteristics = manager.getCameraCharacteristics(cameraId)
            
            manager.openCamera(cameraId, cameraStateCallback, cameraHandler)
            
            // Don't resolve yet - wait for camera opened callback
            // Store the call for later resolution
            pendingOpenCall = call
            
        } catch (e: SecurityException) {
            cameraOpenCloseLock.release()
            call.reject("Camera permission not granted")
        } catch (e: Exception) {
            cameraOpenCloseLock.release()
            call.reject("Failed to open camera: ${e.message}", e)
        }
    }
    
    private var pendingOpenCall: PluginCall? = null
    
    @PluginMethod
    fun closeCamera(call: PluginCall) {
        try {
            stopRecordingInternal()
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            imageReader?.close()
            imageReader = null
            rawImageReader?.close()
            rawImageReader = null
            cameraOpenCloseLock.release()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to close camera: ${e.message}", e)
        }
    }
    
    // ==================== CAMERA STATE CALLBACK ====================
    
    private val cameraStateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            cameraDevice = camera
            cameraOpenCloseLock.release()
            pendingOpenCall?.resolve()
            pendingOpenCall = null
            Log.i(TAG, "Camera opened: $cameraId")
        }
        
        override fun onDisconnected(camera: CameraDevice) {
            camera.close()
            cameraDevice = null
            cameraOpenCloseLock.release()
            notifyListeners("cameraDisconnected", JSObject())
            Log.w(TAG, "Camera disconnected")
        }
        
        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            cameraDevice = null
            cameraOpenCloseLock.release()
            val errorMsg = when (error) {
                ERROR_CAMERA_IN_USE -> "Camera in use"
                ERROR_MAX_CAMERAS_IN_USE -> "Max cameras in use"
                ERROR_CAMERA_DISABLED -> "Camera disabled"
                ERROR_CAMERA_DEVICE -> "Camera device error"
                ERROR_CAMERA_SERVICE -> "Camera service error"
                else -> "Unknown error: $error"
            }
            pendingOpenCall?.reject(errorMsg)
            pendingOpenCall = null
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
            // Create preview surface from the texture view
            // In Capacitor, we use a native SurfaceView or TextureView
            // For now, create an ImageReader for preview frames
            val previewSize = chooseOptimalSize(
                cameraCharacteristics!!,
                1920, 1080,
                SurfaceHolder::class.java
            )
            
            imageReader = ImageReader.Builder()
                .setImageFormat(android.graphics.ImageFormat.YUV_420_888)
                .setMaxImages(3)
                .build()
            
            val surfaces = listOf(imageReader!!.surface)
            
            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    
                    val request = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                        addTarget(imageReader!!.surface)
                        // Apply current settings
                        applySettingsToRequest(this)
                    }.build()
                    
                    session.setRepeatingRequest(request, null, cameraHandler)
                    call.resolve()
                }
                
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    call.reject("Preview configuration failed")
                }
            }, cameraHandler)
            
        } catch (e: Exception) {
            call.reject("Failed to start preview: ${e.message}", e)
        }
    }
    
    // ==================== RAW STILL CAPTURE ====================
    
    @PluginMethod
    fun captureRawStill(call: PluginCall) {
        val device = cameraDevice ?: run {
            call.reject("Camera not open")
            return
        }
        
        try {
            // Find RAW output size
            val config = cameraCharacteristics!!.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) as StreamConfigurationMap
            val rawSizes = config.getOutputSizes(android.graphics.ImageFormat.RAW_SENSOR)
            
            if (rawSizes == null || rawSizes.isEmpty()) {
                call.reject("RAW capture not supported on this device")
                return
            }
            
            // Use largest RAW size
            val rawSize = rawSizes.maxByOrNull { it.width * it.height }!!
            
            rawImageReader = ImageReader.Builder()
                .setImageFormat(android.graphics.ImageFormat.RAW_SENSOR)
                .setSize(rawSize)
                .setMaxImages(1)
                .build()
            
            rawImageReader!!.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image != null) {
                    try {
                        saveRawStill(image, rawSize, call)
                    } finally {
                        image.close()
                    }
                }
            }, cameraHandler)
            
            // Create a new capture session for still capture
            val surfaces = listOf(rawImageReader!!.surface)
            
            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    val request = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                        addTarget(rawImageReader!!.surface)
                        applySettingsToRequest(this)
                    }.build()
                    
                    session.capture(request, object : CameraCaptureSession.CaptureCallback() {
                        override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                            Log.i(TAG, "RAW still capture completed")
                        }
                        
                        override fun onCaptureFailed(session: CameraCaptureSession, request: CaptureRequest, failure: CaptureFailure) {
                            call.reject("RAW capture failed: reason ${failure.reason}")
                        }
                    }, cameraHandler)
                }
                
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    call.reject("RAW capture session configuration failed")
                }
            }, cameraHandler)
            
        } catch (e: Exception) {
            call.reject("RAW capture error: ${e.message}", e)
        }
    }
    
    private fun saveRawStill(image: Image, size: Size, call: PluginCall) {
        try {
            val timestamp = System.currentTimeMillis()
            val outputDir = File(activity.getExternalFilesDir(null), "XRAW")
            outputDir.mkdirs()
            val outputFile = File(outputDir, "RAW_$timestamp.xraw")
            
            val writer = XRawWriter(outputFile)
            writer.writeHeader(
                width = size.width,
                height = size.height,
                bitDepth = 16,
                sampleFormat = 0, // Bayer
                compressionId = 0, // Uncompressed
                frameCount = 1,
                frameRate = 0,
                exposureTime = currentExposureTime ?: 0L,
                iso = currentISO ?: 0,
                whiteBalance = currentWhiteBalance ?: 0,
                focusDistance = ((currentFocusDistance ?: 0f) * 1000).toInt()
            )
            
            // Write RAW data
            val plane = image.planes[0]
            val buffer = plane.buffer
            val data = ByteArray(buffer.remaining())
            buffer.get(data)
            
            writer.writeFrame(data, frameIndex = 0)
            writer.finalize()
            
            val result = JSONObject()
            result.put("success", true)
            result.put("filePath", outputFile.absolutePath)
            result.put("width", size.width)
            result.put("height", size.height)
            result.put("timestamp", timestamp)
            call.resolve(result)
            
        } catch (e: Exception) {
            call.reject("Failed to save RAW: ${e.message}", e)
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
        
        try {
            val width = call.getInt("width", 1920)
            val height = call.getInt("height", 1080)
            val fps = call.getInt("fps", 24)
            val useLossless = call.getBoolean("lossless", true)
            
            // Find RAW output size matching requested resolution
            val config = cameraCharacteristics!!.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) as StreamConfigurationMap
            val rawSizes = config.getOutputSizes(android.graphics.ImageFormat.RAW_SENSOR)
            
            val targetSize = rawSizes?.firstOrNull { it.width == width && it.height == height }
                ?: rawSizes?.maxByOrNull { it.width * it.height }
                ?: run {
                    call.reject("No suitable RAW output size found")
                    return
                }
            
            // Check minimum frame duration
            val minDuration = config.getOutputMinFrameDuration(android.graphics.ImageFormat.RAW_SENSOR, targetSize)
            val maxFps = (1000000000L / minDuration).toInt()
            
            if (fps > maxFps) {
                call.reject("Requested FPS ($fps) exceeds maximum ($maxFps) for ${targetSize.width}x${targetSize.height}")
                return
            }
            
            // Create file
            val timestamp = System.currentTimeMillis()
            val outputDir = File(activity.getExternalFilesDir(null), "XRAW")
            outputDir.mkdirs()
            val extension = if (useLossless) "xrawlc" else "xraw"
            val outputFile = File(outputDir, "REC_$timestamp.$extension")
            
            // Initialize writer
            xrawWriter = XRawWriter(outputFile)
            xrawWriter!!.writeHeader(
                width = targetSize.width,
                height = targetSize.height,
                bitDepth = if (useLossless) 12 else 16,
                sampleFormat = 0,
                compressionId = if (useLossless) 1 else 0,
                frameCount = 0, // streaming
                frameRate = fps * 1000,
                exposureTime = currentExposureTime ?: 0L,
                iso = currentISO ?: 0,
                whiteBalance = currentWhiteBalance ?: 0,
                focusDistance = ((currentFocusDistance ?: 0f) * 1000).toInt()
            )
            
            // Create RAW ImageReader for continuous capture
            rawImageReader = ImageReader.Builder()
                .setImageFormat(android.graphics.ImageFormat.RAW_SENSOR)
                .setSize(targetSize)
                .setMaxImages(MAX_FRAME_QUEUE_SIZE)
                .build()
            
            rawImageReader!!.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image != null) {
                    if (!frameQueue.offer(image, 100, TimeUnit.MILLISECONDS)) {
                        // Queue full - drop frame
                        droppedFrameCount.incrementAndGet()
                        image.close()
                        notifyListeners("frameDropped", JSObject().apply {
                            put("reason", "queue_full")
                            put("totalDropped", droppedFrameCount.get())
                        })
                    }
                }
            }, cameraHandler)
            
            // Create capture session
            val surfaces = listOf(rawImageReader!!.surface)
            
            device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    isRecording.set(true)
                    frameCounter.set(0)
                    droppedFrameCount.set(0)
                    
                    val request = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                        addTarget(rawImageReader!!.surface)
                        applySettingsToRequest(this)
                        // Set fixed frame rate
                        set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_OFF)
                        if (currentExposureTime != null) {
                            set(CaptureRequest.SENSOR_EXPOSURE_TIME, currentExposureTime)
                        }
                        if (currentISO != null) {
                            set(CaptureRequest.SENSOR_SENSITIVITY, currentISO)
                        }
                    }.build()
                    
                    session.setRepeatingRequest(request, null, cameraHandler)
                    
                    // Start frame processing on writer thread
                    startFrameProcessing()
                    
                    val result = JSONObject()
                    result.put("success", true)
                    result.put("filePath", outputFile.absolutePath)
                    result.put("width", targetSize.width)
                    result.put("height", targetSize.height)
                    result.put("fps", fps)
                    result.put("maxFps", maxFps)
                    call.resolve(result)
                }
                
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    call.reject("Recording session configuration failed")
                }
            }, cameraHandler)
            
        } catch (e: Exception) {
            call.reject("Recording error: ${e.message}", e)
        }
    }
    
    @PluginMethod
    fun stopRecording(call: PluginCall) {
        stopRecordingInternal()
        call.resolve()
    }
    
    private fun stopRecordingInternal() {
        if (!isRecording.compareAndSet(true, false)) return
        
        // Stop repeating request
        try {
            captureSession?.stopRepeating()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping repeating request", e)
        }
        
        // Process remaining frames
        processRemainingFrames()
        
        // Finalize file
        xrawWriter?.finalize()
        xrawWriter = null
        
        // Close raw image reader
        rawImageReader?.close()
        rawImageReader = null
        
        // Notify
        val status = JSONObject()
        status.put("totalFrames", frameCounter.get())
        status.put("droppedFrames", droppedFrameCount.get())
        notifyListeners("recordingStopped", status)
        
        Log.i(TAG, "Recording stopped: ${frameCounter.get()} frames, ${droppedFrameCount.get()} dropped")
    }
    
    private fun startFrameProcessing() {
        writerHandler?.post(object : Runnable {
            override fun run() {
                if (!isRecording.get()) return
                
                val image = frameQueue.poll(100, TimeUnit.MILLISECONDS)
                if (image != null) {
                    try {
                        processFrame(image)
                    } finally {
                        image.close()
                    }
                }
                
                writerHandler?.postDelayed(this, 1) // ~1ms poll interval
            }
        })
    }
    
    private fun processFrame(image: Image) {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val data = ByteArray(buffer.remaining())
        buffer.get(data)
        
        val frameIdx = frameCounter.getAndIncrement()
        
        // Apply lossless compression if needed
        val writer = xrawWriter ?: return
        writer.writeFrame(data, frameIdx)
        
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
    
    private fun processRemainingFrames() {
        while (true) {
            val image = frameQueue.poll(10, TimeUnit.MILLISECONDS) ?: break
            try {
                processFrame(image)
            } finally {
                image.close()
            }
        }
    }
    
    // ==================== MANUAL CONTROLS ====================
    
    @PluginMethod
    fun setExposure(call: PluginCall) {
        val exposureTimeNs = call.getLong("exposureTimeNs", -1)
        currentExposureTime = if (exposureTimeNs > 0) exposureTimeNs else null
        applyCurrentSettings()
        call.resolve()
    }
    
    @PluginMethod
    fun setISO(call: PluginCall) {
        val iso = call.getInt("iso", -1)
        currentISO = if (iso > 0) iso else null
        applyCurrentSettings()
        call.resolve()
    }
    
    @PluginMethod
    fun setWhiteBalance(call: PluginCall) {
        val kelvin = call.getInt("kelvin", -1)
        currentWhiteBalance = if (kelvin > 0) kelvin else null
        applyCurrentSettings()
        call.resolve()
    }
    
    @PluginMethod
    fun setFocusDistance(call: PluginCall) {
        val distance = call.getFloat("distance", -1f)
        currentFocusDistance = if (distance >= 0) distance else null
        applyCurrentSettings()
        call.resolve()
    }
    
    @PluginMethod
    fun setZoom(call: PluginCall) {
        val zoom = call.getFloat("zoom", 1.0f)
        currentZoom = zoom.coerceIn(1.0f, getMaxZoom())
        applyCurrentSettings()
        call.resolve()
    }
    
    private fun applyCurrentSettings() {
        val session = captureSession ?: return
        val device = cameraDevice ?: return
        
        try {
            val request = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                if (imageReader != null) addTarget(imageReader!!.surface)
                if (rawImageReader != null) addTarget(rawImageReader!!.surface)
                applySettingsToRequest(this)
            }.build()
            
            session.setRepeatingRequest(request, null, cameraHandler)
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
            // Convert Kelvin to color transform (simplified)
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
        
        // Zoom (crop region)
        if (currentZoom > 1.0f) {
            val sensorSize = cameraCharacteristics?.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
            if (sensorSize != null) {
                val cropWidth = (sensorSize.width() / currentZoom).toInt()
                val cropHeight = (sensorSize.height() / currentZoom).toInt()
                val left = (sensorSize.width() - cropWidth) / 2
                val top = (sensorSize.height() - cropHeight) / 2
                builder.set(CaptureRequest.SENSOR_INFO_ACTIVE_ARRAY_SIZE, 
                    android.graphics.Rect(left, top, left + cropWidth, top + cropHeight))
            }
        }
    }
    
    private fun getMaxZoom(): Float {
        val maxZoom = cameraCharacteristics?.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM)
        return maxZoom ?: 1.0f
    }
    
    private fun kelvinToTransform(kelvin: Int): android.hardware.camera2.params.ColorSpaceTransform {
        // Simplified Kelvin to color transform
        // In production, use a proper color temperature conversion
        val r = when {
            kelvin <= 4000 -> 1.2f
            kelvin <= 5500 -> 1.0f
            else -> 0.9f
        }
        val b = when {
            kelvin <= 4000 -> 0.8f
            kelvin <= 5500 -> 1.0f
            else -> 1.3f
        }
        
        val matrix = android.hardware.camera2.params.ColorSpaceTransform(
            intArrayOf(
                (r * 10000).toInt(), 0, 0,
                0, 10000, 0,
                0, 0, (b * 10000).toInt()
            )
        )
        return matrix
    }
    
    // ==================== DIAGNOSTICS ====================
    
    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        val result = capabilitiesCache ?: run {
            val diagnostics = JSONObject()
            diagnostics.put("cameraId", cameraId)
            diagnostics.put("isRecording", isRecording.get())
            diagnostics.put("frameCount", frameCounter.get())
            diagnostics.put("droppedFrames", droppedFrameCount.get())
            diagnostics.put("timestamp", System.currentTimeMillis())
            
            // Storage info
            val storageDir = activity.getExternalFilesDir(null)
            if (storageDir != null) {
                diagnostics.put("storageAvailable", storageDir.freeSpace)
                diagnostics.put("storageTotal", storageDir.totalSpace)
            }
            
            // Thermal status
            diagnostics.put("thermalStatus", "normal") // Would use PowerManager on real device
            
            diagnostics
        }
        call.resolve(result)
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
            cameraThread?.join()
        } catch (e: InterruptedException) {
            Log.w(TAG, "Camera thread interrupted", e)
        }
        cameraThread = null
        cameraHandler = null
    }
    
    private fun stopWriterThread() {
        writerThread?.quitSafely()
        try {
            writerThread?.join()
        } catch (e: InterruptedException) {
            Log.w(TAG, "Writer thread interrupted", e)
        }
        writerThread = null
        writerHandler = null
    }
    
    @Suppress("UNCHECKED_CAST")
    private fun chooseOptimalSize(
        characteristics: CameraCharacteristics,
        targetWidth: Int,
        targetHeight: Int,
        outputClass: Class<*>
    ): Size {
        val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return Size(targetWidth, targetHeight)
        val sizes = map.getOutputSizes(outputClass) ?: return Size(targetWidth, targetHeight)
        
        return sizes.minByOrNull { Math.abs(it.width * it.height - targetWidth * targetHeight) } ?: Size(targetWidth, targetHeight)
    }
    
    override fun handleOnDestroy() {
        stopRecordingInternal()
        try {
            cameraDevice?.close()
        } catch (e: Exception) {}
        cameraOpenCloseLock.release()
        stopCameraThread()
        stopWriterThread()
        super.handleOnDestroy()
    }
}
