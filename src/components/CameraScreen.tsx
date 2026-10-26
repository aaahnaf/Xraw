import { useState, useEffect } from 'react';
import type { CaptureSettings, RecordingState, CameraInfo } from '../types';

interface Props {
  cameraInfo: CameraInfo;
  settings: CaptureSettings;
  recording: RecordingState;
  previewActive: boolean;
  nativeAvailable: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCaptureStill: () => void;
  onUpdateSetting: <K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => void;
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
}

export function CameraScreen({
  cameraInfo,
  settings,
  recording,
  previewActive,
  nativeAvailable,
  onStartRecording,
  onStopRecording,
  onCaptureStill,
  onUpdateSetting,
  onOpenDiagnostics,
  onOpenSettings,
}: Props) {
  const [showControls, setShowControls] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [showIsoSlider, setShowIsoSlider] = useState(false);
  const [showShutterSlider, setShowShutterSlider] = useState(false);
  const [showWBSlider, setShowWBSlider] = useState(false);
  const [showFocusSlider, setShowFocusSlider] = useState(false);

  // Update recording elapsed time
  useEffect(() => {
    if (!recording.isRecording || recording.startTime == null) {
      setElapsedTime('00:00:00');
      return;
    }

    const startTime = recording.startTime;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 100);

    return () => clearInterval(interval);
  }, [recording.isRecording, recording.startTime]);

  const formatExposure = (ns: number | null) => {
    if (ns === null) return 'AUTO';
    if (ns >= 1000000000) return `${(ns / 1000000000).toFixed(1)}s`;
    if (ns >= 1000000) return `${(ns / 1000000).toFixed(0)}ms`;
    if (ns >= 1000) return `${(ns / 1000).toFixed(0)}µs`;
    return `${ns}ns`;
  };

  const formatISO = (iso: number | null) => {
    if (iso === null) return 'AUTO';
    return `${iso}`;
  };

  const formatWB = (wb: number | null) => {
    if (wb === null) return 'AUTO';
    return `${wb}K`;
  };

  const formatStorage = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* Native Camera Preview - transparent overlay over native TextureView */}
      {/* The actual camera imagery is rendered by CameraPreviewView in Android layout */}
      <div className="absolute inset-0 bg-transparent" />
      
      {/* Native Unavailable Overlay */}
      {!nativeAvailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="text-center space-y-2 px-6">
            <div className="text-[10px] font-mono text-yellow-400/80">CAMERA UNAVAILABLE</div>
            <div className="text-[9px] font-mono text-white/40">
              Native plugin required. Install the Android APK.
            </div>
          </div>
        </div>
      )}
      
      {/* Preview not active indicator */}
      {nativeAvailable && !previewActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-2 px-6">
            <div className="text-[10px] font-mono text-white/50">PREVIEW NOT ACTIVE</div>
            <div className="text-[9px] font-mono text-white/30">
              Camera opened but preview not started
            </div>
          </div>
        </div>
      )}
      
      {/* Toggle Controls */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-2 right-2 z-50 w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
        title="Toggle controls"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>
      </button>

      {showControls && (
        <>
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-3">
              {/* Resolution & FPS */}
              <span className="text-[10px] font-mono text-white/70 tracking-wider">
                {settings.resolution.width}×{settings.resolution.height} @ {settings.frameRate}fps
              </span>
              
              {/* Recording Indicator */}
              {recording.isRecording && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-red-400 tracking-wider">REC</span>
                  <span className="text-[10px] font-mono text-red-400/80">{elapsedTime}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Storage */}
              <span className="text-[10px] font-mono text-white/50">
                {formatStorage(recording.storageAvailable)} free
              </span>
              
              {/* Thermal Warning */}
              {recording.thermalStatus !== 'normal' && (
                <span className={`text-[10px] font-mono ${
                  recording.thermalStatus === 'mild' ? 'text-yellow-400' : 
                  recording.thermalStatus === 'severe' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  ⚠ THERMAL
                </span>
              )}
              
              {/* Menu */}
              <button onClick={onOpenSettings} className="text-white/50 hover:text-white/80">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Left Side Controls */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {/* ISO */}
            <button
              onClick={() => { setShowIsoSlider(!showIsoSlider); setShowShutterSlider(false); setShowWBSlider(false); setShowFocusSlider(false); }}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                settings.iso !== null 
                  ? 'border-white/30 text-white/90 bg-white/5' 
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              ISO {formatISO(settings.iso)}
            </button>
            
            {/* Shutter */}
            <button
              onClick={() => { setShowShutterSlider(!showShutterSlider); setShowIsoSlider(false); setShowWBSlider(false); setShowFocusSlider(false); }}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                settings.exposureTime !== null 
                  ? 'border-white/30 text-white/90 bg-white/5' 
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              ⏱ {formatExposure(settings.exposureTime)}
            </button>
            
            {/* White Balance */}
            <button
              onClick={() => { setShowWBSlider(!showWBSlider); setShowIsoSlider(false); setShowShutterSlider(false); setShowFocusSlider(false); }}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                settings.whiteBalance !== null 
                  ? 'border-white/30 text-white/90 bg-white/5' 
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              WB {formatWB(settings.whiteBalance)}
            </button>
            
            {/* Focus */}
            <button
              onClick={() => { setShowFocusSlider(!showFocusSlider); setShowIsoSlider(false); setShowShutterSlider(false); setShowWBSlider(false); }}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                settings.focusDistance !== null 
                  ? 'border-white/30 text-white/90 bg-white/5' 
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              ◎ {settings.focusDistance !== null ? `${settings.focusDistance.toFixed(1)}m` : 'AF'}
            </button>
          </div>

          {/* Sliders Panel */}
          {(showIsoSlider || showShutterSlider || showWBSlider || showFocusSlider) && (
            <div className="absolute left-14 top-1/2 -translate-y-1/2 z-40 bg-black/80 border border-white/10 rounded px-3 py-2 w-48">
              {showIsoSlider && (
                <div>
                  <label className="text-[9px] text-white/50 font-mono block mb-1">ISO / SENSITIVITY</label>
                  <input
                    type="range"
                    min="50"
                    max="3200"
                    step="50"
                    value={settings.iso ?? 400}
                    onChange={(e) => onUpdateSetting('iso', Number(e.target.value))}
                    className="w-full h-1 accent-white"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-mono mt-0.5">
                    <span>50</span>
                    <button onClick={() => onUpdateSetting('iso', null)} className="text-white/50 hover:text-white/80">AUTO</button>
                    <span>3200</span>
                  </div>
                </div>
              )}
              {showShutterSlider && (
                <div>
                  <label className="text-[9px] text-white/50 font-mono block mb-1">EXPOSURE TIME</label>
                  <input
                    type="range"
                    min="100"
                    max="100000000"
                    step="100"
                    value={settings.exposureTime ?? 41666666}
                    onChange={(e) => onUpdateSetting('exposureTime', Number(e.target.value))}
                    className="w-full h-1 accent-white"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-mono mt-0.5">
                    <span>1/10000</span>
                    <button onClick={() => onUpdateSetting('exposureTime', null)} className="text-white/50 hover:text-white/80">AUTO</button>
                    <span>1/10</span>
                  </div>
                </div>
              )}
              {showWBSlider && (
                <div>
                  <label className="text-[9px] text-white/50 font-mono block mb-1">WHITE BALANCE (K)</label>
                  <input
                    type="range"
                    min="2000"
                    max="8000"
                    step="100"
                    value={settings.whiteBalance ?? 5500}
                    onChange={(e) => onUpdateSetting('whiteBalance', Number(e.target.value))}
                    className="w-full h-1 accent-white"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-mono mt-0.5">
                    <span>2000K</span>
                    <button onClick={() => onUpdateSetting('whiteBalance', null)} className="text-white/50 hover:text-white/80">AUTO</button>
                    <span>8000K</span>
                  </div>
                </div>
              )}
              {showFocusSlider && (
                <div>
                  <label className="text-[9px] text-white/50 font-mono block mb-1">FOCUS DISTANCE</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={settings.focusDistance ?? 1.0}
                    onChange={(e) => onUpdateSetting('focusDistance', Number(e.target.value))}
                    className="w-full h-1 accent-white"
                  />
                  <div className="flex justify-between text-[8px] text-white/30 font-mono mt-0.5">
                    <span>∞</span>
                    <button onClick={() => onUpdateSetting('focusDistance', null)} className="text-white/50 hover:text-white/80">AF</button>
                    <span>0.1m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Side Controls */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 items-end">
            {/* Zoom */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => onUpdateSetting('zoom', Math.min(settings.zoom + 0.5, 8.0))}
                className="w-6 h-6 flex items-center justify-center text-[10px] font-mono text-white/50 hover:text-white/80 border border-white/10 rounded"
              >
                +
              </button>
              <span className="text-[9px] font-mono text-white/50">{settings.zoom.toFixed(1)}×</span>
              <button
                onClick={() => onUpdateSetting('zoom', Math.max(settings.zoom - 0.5, 1.0))}
                className="w-6 h-6 flex items-center justify-center text-[10px] font-mono text-white/50 hover:text-white/80 border border-white/10 rounded"
              >
                −
              </button>
            </div>
            
            {/* LUT Toggle */}
            <button
              onClick={() => onUpdateSetting('lutEnabled', !settings.lutEnabled)}
              className={`px-2 py-1 rounded text-[9px] font-mono border transition-colors ${
                settings.lutEnabled 
                  ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5' 
                  : 'border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              LUT {settings.lutEnabled ? 'ON' : 'OFF'}
            </button>
            
            {/* Diagnostics */}
            <button
              onClick={onOpenDiagnostics}
              className="px-2 py-1 rounded text-[9px] font-mono border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 transition-colors"
            >
              DIAG
            </button>
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-40 flex items-end justify-between px-4 pb-4 bg-gradient-to-t from-black/60 to-transparent">
            {/* RAW Still Button */}
            <button
              onClick={nativeAvailable ? onCaptureStill : undefined}
              disabled={!nativeAvailable}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors active:scale-95 ${
                nativeAvailable 
                  ? 'border-white/30 hover:border-white/60' 
                  : 'border-white/10 opacity-40 cursor-not-allowed'
              }`}
              title={nativeAvailable ? "Capture RAW Still" : "Requires native build"}
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-[8px] font-mono text-white/70">RAW</span>
              </div>
            </button>
            
            {/* Recording Button */}
            <button
              onClick={nativeAvailable ? (recording.isRecording ? onStopRecording : onStartRecording) : undefined}
              disabled={!nativeAvailable}
              className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                !nativeAvailable 
                  ? 'border-white/10 opacity-40 cursor-not-allowed'
                  : recording.isRecording 
                    ? 'border-red-500 hover:border-red-400' 
                    : 'border-white/40 hover:border-white/70'
              }`}
              title={nativeAvailable ? (recording.isRecording ? 'Stop Recording' : 'Start Recording') : 'Requires native build'}
            >
              {recording.isRecording ? (
                <div className="w-6 h-6 rounded-sm bg-red-500" />
              ) : (
                <div className={`w-10 h-10 rounded-full ${nativeAvailable ? 'bg-red-500/80' : 'bg-white/10'}`} />
              )}
            </button>
            
            {/* Frame Counter / Status */}
            <div className="text-right">
              {recording.isRecording && (
                <div className="text-[9px] font-mono text-white/50">
                  <div>{recording.frameCount} frames</div>
                  {recording.droppedFrames > 0 && (
                    <div className="text-red-400">{recording.droppedFrames} dropped</div>
                  )}
                  <div>{formatStorage(recording.currentFileSize)}</div>
                </div>
              )}
              {!recording.isRecording && (
                <div className="text-[9px] font-mono text-white/40">
                  <div>READY</div>
                  <div>{settings.resolution.width}×{settings.resolution.height}</div>
                </div>
              )}
            </div>
          </div>

          {/* Status Bar - Bottom Left */}
          <div className="absolute bottom-16 left-3 z-40">
            <div className="text-[8px] font-mono text-white/30 space-y-0.5">
              <div>CAM {cameraInfo.id} | {cameraInfo.hardwareLevel.toUpperCase()}</div>
              <div>{cameraInfo.rawSupported ? 'RAW ✓' : 'RAW ✗'} | {cameraInfo.manualControls ? 'MANUAL ✓' : 'MANUAL ✗'}</div>
            </div>
          </div>
        </>
      )}
      
      {/* Recording border indicator */}
      {recording.isRecording && (
        <div className="absolute inset-0 z-30 pointer-events-none border border-red-500/20 rounded-sm" />
      )}
    </div>
  );
}
