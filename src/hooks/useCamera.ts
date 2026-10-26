import { useState, useCallback, useRef, useEffect } from 'react';
import type { CaptureSettings, RecordingState, CameraInfo, AppError, Screen } from '../types';

// Simulated camera info for web preview mode
const SIMULATED_CAMERA: CameraInfo = {
  id: '0',
  facing: 'back',
  hardwareLevel: 'level_3',
  capabilities: ['RAW_SENSOR', 'MANUAL_SENSOR', 'MANUAL_POST_PROCESSING', 'RAW12'],
  rawSupported: true,
  manualControls: true,
  sensorInfo: {
    width: 4000,
    height: 3000,
    physicalSize: { width: 6.43, height: 4.82 },
    pixelArraySize: { width: 4000, height: 3000 },
    exposureTimeRange: { min: 100000, max: 200000000000 }, // 100µs to 200s
    sensitivityRange: { min: 50, max: 3200 },
    whiteBalanceRange: { min: 2000, max: 8000 },
    colorFilterArrangement: 0, // RGGB
  },
};

export function useCamera() {
  const [screen, setScreen] = useState<Screen>('camera');
  const [cameraInfo, setCameraInfo] = useState<CameraInfo>(SIMULATED_CAMERA);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [previewActive, setPreviewActive] = useState(false);
  
  const [settings, setSettings] = useState<CaptureSettings>({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    exposureTime: null, // auto
    iso: null, // auto
    whiteBalance: null, // auto
    focusDistance: null, // auto
    zoom: 1.0,
    lutEnabled: false,
    lutPath: null,
  });
  
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    startTime: null,
    frameCount: 0,
    droppedFrames: 0,
    currentFileSize: 0,
    storageAvailable: 50 * 1024 * 1024 * 1024, // 50GB simulated
    thermalStatus: 'normal',
    filePath: null,
  });
  
  const recordingIntervalRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  const addError = useCallback((code: string, message: string, severity: AppError['severity'], recoverable: boolean) => {
    setErrors(prev => [...prev.slice(-9), { code, message, severity, timestamp: Date.now(), recoverable }]);
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  const openCamera = useCallback(async () => {
    try {
      // In native mode, this calls the Capacitor plugin
      // In web mode, we simulate camera opening
      setIsCameraOpen(true);
      setPreviewActive(true);
    } catch (err) {
      addError('CAMERA_OPEN_FAILED', 'Failed to open camera', 'error', true);
    }
  }, [addError]);

  const closeCamera = useCallback(async () => {
    if (recording.isRecording) {
      await stopRecording();
    }
    setIsCameraOpen(false);
    setPreviewActive(false);
  }, [recording.isRecording]);

  const startRecording = useCallback(() => {
    if (recording.isRecording) return;
    
    const now = Date.now();
    const filePath = `/storage/emulated/0/XRAW/REC_${now}.xrawlc`;
    
    setRecording(prev => ({
      ...prev,
      isRecording: true,
      startTime: now,
      frameCount: 0,
      droppedFrames: 0,
      currentFileSize: 0,
      filePath,
    }));
    
    frameCountRef.current = 0;
    
    // Simulate frame counting
    recordingIntervalRef.current = window.setInterval(() => {
      frameCountRef.current += 1;
      const elapsed = Date.now() - now;
      const fileSize = frameCountRef.current * (1920 * 1080 * 2); // ~4MB per frame RAW
      
      setRecording(prev => ({
        ...prev,
        frameCount: frameCountRef.current,
        currentFileSize: fileSize,
        storageAvailable: Math.max(0, prev.storageAvailable - 1920 * 1080 * 2),
      }));
      
      // Simulate thermal increase over time
      if (elapsed > 120000) { // 2 minutes
        setRecording(prev => ({
          ...prev,
          thermalStatus: elapsed > 300000 ? 'severe' : 'mild',
        }));
      }
    }, 1000 / 24); // 24fps
  }, [recording.isRecording]);

  const stopRecording = useCallback(async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setRecording(prev => ({
      ...prev,
      isRecording: false,
      startTime: null,
    }));
  }, []);

  const captureRawStill = useCallback(async () => {
    const timestamp = Date.now();
    const filePath = `/storage/emulated/0/XRAW/RAW_${timestamp}.xraw`;
    
    addError('CAPTURE_OK', `RAW still captured: RAW_${timestamp}.xraw`, 'info', false);
    
    // In native mode, this triggers actual RAW capture via Camera2
    return { success: true, filePath, timestamp };
  }, [addError]);

  const updateSetting = useCallback(<K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  return {
    screen,
    setScreen,
    cameraInfo,
    isCameraOpen,
    previewActive,
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
