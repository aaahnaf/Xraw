// XRAW Camera Type Definitions

export interface CameraInfo {
  id: string;
  facing: 'front' | 'back' | 'external';
  hardwareLevel: 'legacy' | 'limited' | 'full' | 'level_3' | 'external' | 'unknown';
  capabilities: string[];
  rawSupported: boolean;
  manualControls: boolean;
  sensorInfo: SensorInfo | null;
}

export interface SensorInfo {
  width: number;
  height: number;
  physicalSize: { width: number; height: number };
  pixelArraySize: { width: number; height: number };
  exposureTimeRange: { min: number; max: number };
  sensitivityRange: { min: number; max: number };
  whiteBalanceRange: { min: number; max: number };
  colorFilterArrangement: number;
}

export type CaptureMode = 'raw' | 'log_video';

export type LogProfile = 
  | 'none'
  | 'slog3'        // Sony S-Log3
  | 'clog3'        // Canon C-Log3
  | 'vlog'         // Panasonic V-Log
  | 'logc'         // ARRI LogC3
  | 'flog'         // Fujifilm F-Log
  | 'nlog'         // Nikon N-Log
  | 'dlog'         // DJI D-Log
  | 'redlogfilm'   // RED REDlogFilm
  | 'bmfilm'       // Blackmagic Film
  | 'slog2';       // Sony S-Log2

export interface LogProfileInfo {
  id: LogProfile;
  name: string;
  vendor: string;
  variant: string;
  implemented: boolean;
  approximate: boolean;
  notes: string;
}

export interface CaptureSettings {
  resolution: { width: number; height: number };
  frameRate: number;
  previewFrameRate: number; // Independent preview FPS
  exposureTime: number | null; // nanoseconds, null = auto
  iso: number | null; // null = auto
  whiteBalance: number | null; // Kelvin, null = auto
  focusDistance: number | null; // diopters, null = auto
  zoom: number; // 1.0 = no zoom
  // Capture mode
  mode: CaptureMode;
  // Log video profile (only used in log_video mode)
  logProfile: LogProfile;
  // Preview LUT (display only, does not affect captured data)
  lutEnabled: boolean;
  lutPath: string | null;
  // RAW file compression (only used in raw mode)
  losslessCompression: boolean; // true = .xrawlc, false = .xraw
  // UI preferences
  showGrid: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  frameCount: number;
  droppedFrames: number;
  currentFileSize: number;
  storageAvailable: number;
  thermalStatus: 'normal' | 'mild' | 'severe' | 'critical';
  filePath: string | null;
  // Real measured FPS
  measuredPreviewFps: number;
  measuredRecordingFps: number;
  measuredEncoderFps: number;
}

export interface DiagnosticsResult {
  cameraId: string;
  rawFormats: RawFormat[];
  supportedResolutions: Resolution[];
  fpsRanges: { min: number; max: number }[];
  manualSensorControl: boolean;
  hardwareLevel: string;
  timestamp: string;
}

export interface RawFormat {
  format: string;
  width: number;
  height: number;
  bitDepth: number;
  minFrameDuration: number;
}

export interface Resolution {
  width: number;
  height: number;
  supported: boolean;
  rawAvailable: boolean;
}

export interface XRAWHeader {
  magic: number; // 0x58524157 "XRAW"
  version: number;
  headerSize: number;
  imageWidth: number;
  imageHeight: number;
  sampleFormat: number; // 0=RAW_BAYER, 1=RAW_MONO
  bitDepth: number;
  packingLayout: number;
  cfaPattern: number; // 0=RGGB, 1=BGGR, 2=GRBG, 3=GBRG
  compressionId: number; // 0=none, 1=xrawlc_lossless
  frameCount: number;
  frameRate: number;
  timestamp: number;
  exposureTime: number;
  iso: number;
  whiteBalance: number;
  focusDistance: number;
  checksumAlgorithm: number; // 0=CRC32, 1=SHA256
  recoveryInterval: number;
  reserved: number[];
}

export type Screen = 'camera' | 'diagnostics' | 'settings' | 'about';

export interface AppError {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: number;
  recoverable: boolean;
}
