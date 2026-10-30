import { useState, useCallback, useRef, useEffect } from 'react';
import type { CaptureSettings, RecordingState, CameraInfo, AppError, Screen } from '../types';
import { getResolutionDimensions } from '../types';
import { NativeBridge } from '../utils/native-bridge';

/**
 * Camera hook that connects to the native XRawCamera Capacitor plugin.
 * 
 * When running on a real Android device with the native plugin installed:
 * - All operations go through the native bridge
 * - Camera data is real
 * - Recording status comes from native events
 * 
 * When running in a desktop browser (development):
 * - Shows explicit "unavailable" state
 * - Does NOT simulate or fake any camera behavior
 * - UI controls are visible but disabled with clear messaging
 */
export function useCamera() {
  const [screen, setScreen] = useState<Screen>('camera');
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [previewActive, setPreviewActive] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  const [settings, setSettings] = useState<CaptureSettings>({
    resolution: '1080p_open_gate',
    frameRate: 24,
    previewFrameRate: 30,
    exposureTime: null,
    iso: null,
    whiteBalance: null,
    focusDistance: null,
    zoom: 1.0,
    mode: 'mlv',
    lutEnabled: false,
    lutPath: null,
    losslessCompression: true,
    showGrid: false,
  });
  
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    startTime: null,
    frameCount: 0,
    droppedFrames: 0,
    currentFileSize: 0,
    storageAvailable: 0,
    thermalStatus: 'normal',
    filePath: null,
    measuredPreviewFps: 0,
    measuredRecordingFps: 0,
    measuredEncoderFps: 0,
  });

  const cleanupFnsRef = useRef<(() => void)[]>([]);
  
  const addError = useCallback((code: string, message: string, severity: AppError['severity'], recoverable: boolean) => {
    setErrors(prev => [...prev.slice(-9), { code, message, severity, timestamp: Date.now(), recoverable }]);
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  // Initialize: check native availability and enumerate cameras
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setInitializing(true);
      
      // Wait for Capacitor to be fully ready
      // This prevents race conditions where frontend checks before plugin is registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const available = NativeBridge.available;
      setNativeAvailable(available);

      if (!available) {
        // Running in browser — show development mode
        addError('NATIVE_UNAVAILABLE', 
          'Native camera plugin not available. Running in browser development mode. Build and install the APK for camera access.',
          'warning', false);
        setInitializing(false);
        return;
      }

      try {
        // Check permissions
        const perms = await NativeBridge.checkPermissions();
        if (perms.camera !== 'granted') {
          await NativeBridge.requestPermissions();
        }

        // Enumerate cameras
        const result = await NativeBridge.enumerateCameras();
        if (!cancelled && result.cameras && result.cameras.length > 0) {
          const cam = result.cameras[0];
          setCameraInfo({
            id: cam.id,
            facing: cam.facing,
            hardwareLevel: cam.hardwareLevel,
            capabilities: Array.from(cam.capabilities || []),
            rawSupported: cam.rawSupported || false,
            manualControls: cam.manualControls || false,
            sensorInfo: cam.sensorInfo ? {
              width: cam.sensorInfo.width,
              height: cam.sensorInfo.height,
              physicalSize: cam.sensorInfo.physicalSize || { width: 0, height: 0 },
              pixelArraySize: cam.sensorInfo.pixelArraySize || { width: 0, height: 0 },
              exposureTimeRange: cam.sensorInfo.exposureTimeRange || { min: 0, max: 0 },
              sensitivityRange: cam.sensorInfo.sensitivityRange || { min: 0, max: 0 },
              whiteBalanceRange: cam.sensorInfo.whiteBalanceRange || { min: 2000, max: 8000 },
              colorFilterArrangement: cam.sensorInfo.colorFilterArrangement ?? -1,
            } : null,
          });
        }

        // Register native event listeners
        const cleanups: (() => void)[] = [];

        cleanups.push(NativeBridge.onCameraError((data) => {
          addError('CAMERA_ERROR', data.error || 'Unknown camera error', 'error', true);
        }));

        cleanups.push(NativeBridge.onCameraDisconnected(() => {
          setIsCameraOpen(false);
          setPreviewActive(false);
          addError('CAMERA_DISCONNECTED', 'Camera disconnected', 'error', true);
        }));

        cleanups.push(NativeBridge.onRecordingProgress((data) => {
          setRecording(prev => ({
            ...prev,
            frameCount: data.frameCount ?? prev.frameCount,
            droppedFrames: data.droppedFrames ?? prev.droppedFrames,
            currentFileSize: data.fileSize ?? prev.currentFileSize,
          }));
        }));

        cleanups.push(NativeBridge.onRecordingStopped((data) => {
          setRecording(prev => ({
            ...prev,
            isRecording: false,
            startTime: null,
            frameCount: data.totalFrames ?? prev.frameCount,
            droppedFrames: data.droppedFrames ?? prev.droppedFrames,
          }));
        }));

        cleanups.push(NativeBridge.onFrameDropped((data) => {
          addError('FRAME_DROPPED', `Frame dropped: ${data.reason} (total: ${data.totalDropped})`, 'warning', false);
        }));

        cleanups.push(NativeBridge.onPreviewStarted(() => {
          setPreviewActive(true);
        }));

        cleanups.push(NativeBridge.onPreviewRestored(() => {
          setPreviewActive(true);
        }));

        cleanupFnsRef.current = cleanups;
      } catch (err: any) {
        if (!cancelled) {
          addError('INIT_FAILED', `Initialization failed: ${err.message || err}`, 'error', true);
        }
      }

      if (!cancelled) {
        setInitializing(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
    };
  }, [addError]);

  const openCamera = useCallback(async () => {
    if (!nativeAvailable) {
      addError('NOT_NATIVE', 'Camera requires native Android build', 'error', false);
      return;
    }

    try {
      await NativeBridge.openCamera(cameraInfo?.id || '0');
      setIsCameraOpen(true);
      
      await NativeBridge.startPreview();
      setPreviewActive(true);
    } catch (err: any) {
      addError('CAMERA_OPEN_FAILED', err.message || 'Failed to open camera', 'error', true);
    }
  }, [nativeAvailable, cameraInfo, addError]);

  const startRecording = useCallback(async () => {
    if (!nativeAvailable || recording.isRecording) return;

    try {
      let result;
      const dims = getResolutionDimensions(settings.resolution);
      
      if (settings.mode === 'mlv') {
        // MLV mode - use MLV writer
        result = await NativeBridge.startMlvRecording({
          width: dims.width,
          height: dims.height,
          fps: settings.frameRate,
        });
      } else {
        // RAW mode - use XRAW/XRAWLC
        result = await NativeBridge.startRecording({
          width: dims.width,
          height: dims.height,
          fps: settings.frameRate,
          lossless: settings.losslessCompression,
        });

        if (result.sizeMismatch) {
          addError('SIZE_MISMATCH', 
            `Actual resolution: ${result.width}×${result.height} (requested ${dims.width}×${dims.height})`,
            'warning', false);
        }
      }

      setRecording({
        isRecording: true,
        startTime: Date.now(),
        frameCount: 0,
        droppedFrames: 0,
        currentFileSize: 0,
        storageAvailable: 0,
        thermalStatus: 'normal',
        filePath: result.filePath,
        measuredPreviewFps: 0,
        measuredRecordingFps: 0,
        measuredEncoderFps: 0,
      });
    } catch (err: any) {
      addError('RECORDING_FAILED', err.message || 'Failed to start recording', 'error', true);
    }
  }, [nativeAvailable, recording.isRecording, settings, addError]);

  const stopRecording = useCallback(async () => {
    if (!nativeAvailable) {
      // If not native, just reset the state
      setRecording(prev => ({
        ...prev,
        isRecording: false,
        startTime: null,
      }));
      return;
    }

    try {
      let result;
      
      if (settings.mode === 'mlv') {
        result = await NativeBridge.stopMlvRecording();
      } else {
        result = await NativeBridge.stopRecording();
      }
      
      setRecording(prev => ({
        ...prev,
        isRecording: false,
        startTime: null,
        frameCount: result.totalFrames ?? prev.frameCount,
        droppedFrames: result.droppedFrames ?? prev.droppedFrames,
        measuredRecordingFps: (result as any).measuredFps ?? prev.measuredRecordingFps,
      }));
    } catch (err: any) {
      // Even if stop fails, reset recording state to prevent stuck state
      setRecording(prev => ({
        ...prev,
        isRecording: false,
        startTime: null,
      }));
      addError('STOP_FAILED', err.message || 'Failed to stop recording', 'error', true);
    }
  }, [nativeAvailable, settings.mode, addError]);

  const closeCamera = useCallback(async () => {
    if (recording.isRecording) {
      await stopRecording();
    }
    
    try {
      if (nativeAvailable) {
        await NativeBridge.closeCamera();
      }
    } catch (err: any) {
      addError('CAMERA_CLOSE_FAILED', err.message || 'Failed to close camera', 'warning', true);
    }
    
    setIsCameraOpen(false);
    setPreviewActive(false);
  }, [recording.isRecording, nativeAvailable, addError, stopRecording]);

  const captureRawStill = useCallback(async () => {
    if (!nativeAvailable) {
      addError('NOT_NATIVE', 'RAW capture requires native Android build', 'error', false);
      return { success: false, filePath: '', timestamp: 0 };
    }

    try {
      const result = await NativeBridge.captureRawStill();
      
      if (result.success) {
        addError('CAPTURE_OK', 
          `RAW captured: ${result.width}×${result.height} @ ${result.bitDepth}bit (${(result.dataSize / 1024).toFixed(0)}KB)`,
          'info', false);
      }
      
      return result;
    } catch (err: any) {
      addError('CAPTURE_FAILED', err.message || 'RAW capture failed', 'error', true);
      return { success: false, filePath: '', timestamp: 0 };
    }
  }, [nativeAvailable, addError]);

  const updateSetting = useCallback(async <K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    // Apply to native if available
    if (!nativeAvailable) return;

    try {
      switch (key) {
        case 'exposureTime':
          await NativeBridge.setExposure(value as number | null);
          break;
        case 'iso':
          await NativeBridge.setISO(value as number | null);
          break;
        case 'whiteBalance':
          await NativeBridge.setWhiteBalance(value as number | null);
          break;
        case 'focusDistance':
          await NativeBridge.setFocusDistance(value as number | null);
          break;
        case 'zoom':
          await NativeBridge.setZoom(value as number);
          break;
      }
    } catch (err: any) {
      addError('SETTING_FAILED', `Failed to apply ${key}: ${err.message || err}`, 'warning', true);
    }
  }, [nativeAvailable, addError]);

  // Update diagnostics periodically when recording
  useEffect(() => {
    if (!recording.isRecording || !nativeAvailable) return;

    const interval = setInterval(async () => {
      try {
        const diag = await NativeBridge.getDiagnostics();
        setRecording(prev => ({
          ...prev,
          storageAvailable: diag.storageAvailable || 0,
          thermalStatus: diag.thermalStatus || 'normal',
        }));
      } catch {
        // Non-critical
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [recording.isRecording, nativeAvailable]);

  return {
    screen,
    setScreen,
    cameraInfo,
    isCameraOpen,
    previewActive,
    nativeAvailable,
    initializing,
    settings,
    recording,
    errors,
    openCamera,
    closeCamera,
    startRecording,
    stopRecording,
    captureRawStill,
    updateSetting,
    addError,
    clearErrors,
  };
}
