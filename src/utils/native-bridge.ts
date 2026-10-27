/**
 * XRAW Camera Native Bridge
 * 
 * Provides typed access to the native XRawCamera Capacitor plugin.
 * When running in a browser without the native plugin, returns
 * explicit "unavailable" states rather than simulating behavior.
 */

// Detect if we're running inside Capacitor with the native plugin
function isNativeAvailable(): boolean {
  try {
    // Check for Capacitor's native bridge
    const win = window as any;
    return !!(win.Capacitor && win.Capacitor.isNativePlatform && win.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

async function callNative(method: string, args: Record<string, any> = {}): Promise<any> {
  const win = window as any;
  
  if (!win.Capacitor || !win.Capacitor.Plugins || !win.Capacitor.Plugins.XRawCamera) {
    throw new Error('XRawCamera native plugin not available');
  }
  
  const plugin = win.Capacitor.Plugins.XRawCamera;
  
  if (typeof plugin[method] !== 'function') {
    throw new Error(`Method ${method} not found on XRawCamera plugin`);
  }
  
  return plugin[method](args);
}

function addNativeListener(event: string, callback: (data: any) => void): () => void {
  const win = window as any;
  
  if (!win.Capacitor || !win.Capacitor.Plugins || !win.Capacitor.Plugins.XRawCamera) {
    return () => {};
  }
  
  return win.Capacitor.Plugins.XRawCamera.addListener(event, callback);
}

// ==================== Public API ====================

export const NativeBridge = {
  get available(): boolean {
    return isNativeAvailable();
  },

  async checkPermissions(): Promise<{ camera: string; storage: string }> {
    if (!isNativeAvailable()) {
      return { camera: 'unavailable', storage: 'unavailable' };
    }
    return callNative('checkPermissions');
  },

  async requestPermissions(): Promise<void> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    await callNative('requestPermissions');
  },

  async enumerateCameras(): Promise<{ cameras: any[] }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('enumerateCameras');
  },

  async openCamera(cameraId: string = '0'): Promise<void> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    await callNative('openCamera', { cameraId });
  },

  async closeCamera(): Promise<void> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    await callNative('closeCamera');
  },

  async startPreview(): Promise<void> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    await callNative('startPreview');
  },

  async captureRawStill(): Promise<{
    success: boolean;
    filePath: string;
    width: number;
    height: number;
    bitDepth: number;
    rowStride: number;
    pixelStride: number;
    dataSize: number;
    timestamp: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('captureRawStill');
  },

  async startRecording(options: {
    width: number;
    height: number;
    fps: number;
    lossless: boolean;
  }): Promise<{
    success: boolean;
    filePath: string;
    width: number;
    height: number;
    fps: number;
    maxFps: number;
    sizeMismatch: boolean;
    lossless: boolean;
    bitDepth: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('startRecording', options);
  },

  async stopRecording(): Promise<{
    totalFrames: number;
    droppedFrames: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('stopRecording');
  },

  async startLogVideoRecording(options: {
    width: number;
    height: number;
    fps: number;
    logProfile: string;
  }): Promise<{
    success: boolean;
    filePath: string;
    width: number;
    height: number;
    fps: number;
    logProfile: string;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('startLogVideoRecording', options);
  },

  async startMlvRecording(options: {
    width: number;
    height: number;
    fps: number;
  }): Promise<{
    success: boolean;
    filePath: string;
    width: number;
    height: number;
    fps: number;
    bitDepth: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('startMlvRecording', options);
  },

  async stopLogVideoRecording(): Promise<{
    totalFrames: number;
    droppedFrames: number;
    measuredFps: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('stopLogVideoRecording');
  },

  async stopMlvRecording(): Promise<{
    totalFrames: number;
    droppedFrames: number;
  }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('stopRecording');
  },

  async setPreviewFrameRate(fps: number): Promise<{ applied: number; requested: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setPreviewFrameRate', { fps });
  },

  async setExposure(exposureTimeNs: number | null): Promise<{ applied: number | null; requested: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setExposure', { exposureTimeNs: exposureTimeNs ?? -1 });
  },

  async setISO(iso: number | null): Promise<{ applied: number | null; requested: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setISO', { iso: iso ?? -1 });
  },

  async setWhiteBalance(kelvin: number | null): Promise<{ applied: number | null; requested: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setWhiteBalance', { kelvin: kelvin ?? -1 });
  },

  async setFocusDistance(distance: number | null): Promise<{ applied: number | null; requested: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setFocusDistance', { distance: distance ?? -1 });
  },

  async setZoom(zoom: number): Promise<{ applied: number; requested: number; maxZoom: number }> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('setZoom', { zoom });
  },

  async getDiagnostics(): Promise<any> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('getDiagnostics');
  },

  async getRecordingStatus(): Promise<any> {
    if (!isNativeAvailable()) {
      throw new Error('Native plugin not available');
    }
    return callNative('getRecordingStatus');
  },

  // Event listeners
  onCameraOpened(callback: (data: any) => void): () => void {
    return addNativeListener('cameraOpened', callback);
  },

  onCameraDisconnected(callback: (data: any) => void): () => void {
    return addNativeListener('cameraDisconnected', callback);
  },

  onCameraError(callback: (data: any) => void): () => void {
    return addNativeListener('cameraError', callback);
  },

  onRecordingProgress(callback: (data: any) => void): () => void {
    return addNativeListener('recordingProgress', callback);
  },

  onRecordingStopped(callback: (data: any) => void): () => void {
    return addNativeListener('recordingStopped', callback);
  },

  onFrameDropped(callback: (data: any) => void): () => void {
    return addNativeListener('frameDropped', callback);
  },

  onPreviewStarted(callback: (data: any) => void): () => void {
    return addNativeListener('previewStarted', callback);
  },

  onPreviewRestored(callback: (data: any) => void): () => void {
    return addNativeListener('previewRestored', callback);
  },
};
