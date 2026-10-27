import { useState, useEffect } from 'react';
import type { CaptureSettings, RecordingState, CameraInfo, LogProfile } from '../types';
import { getProfileInfo, getAvailableProfiles } from '../utils/log-profiles';
import { getResolutionDimensions } from '../types';

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
  const [activeControl, setActiveControl] = useState<string | null>(null);

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
    if (ns >= 1000000) return `${(ns / 1000000).toFixed(1)}ms`;
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

  const getModeLabel = () => {
    if (settings.mode === 'raw') {
      return settings.losslessCompression ? 'RAW LC' : 'RAW';
    } else if (settings.mode === 'mlv') {
      return 'MLV';
    } else {
      const profile = getProfileInfo(settings.logProfile);
      return profile.name.toUpperCase();
    }
  };

  const dims = getResolutionDimensions(settings.resolution);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* Native Camera Preview - transparent to show native view */}
      <div className="absolute inset-0" />
      
      {/* Grid Overlay */}
      {settings.showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>
        </div>
      )}

      {/* Native Unavailable Overlay */}
      {!nativeAvailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="text-center space-y-3 px-8">
            <div className="text-sm font-medium text-amber-400">Camera Unavailable</div>
            <div className="text-xs text-neutral-500">Install the Android APK</div>
          </div>
        </div>
      )}

      {/* Preview Not Active */}
      {nativeAvailable && !previewActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="text-xs text-neutral-500">Preview Not Active</div>
        </div>
      )}

      {/* Controls Layer */}
      {showControls && (
        <>
          {/* Top Status Bar - Compact */}
          <div className="absolute top-0 left-0 right-0 z-40 px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Mode Selector */}
                <button
                  onClick={() => {
                    const modes: Array<'raw' | 'mlv' | 'log_video'> = ['raw', 'mlv', 'log_video'];
                    const currentIndex = modes.indexOf(settings.mode);
                    const nextIndex = (currentIndex + 1) % modes.length;
                    onUpdateSetting('mode', modes[nextIndex]);
                  }}
                  className="px-3 py-1.5 rounded bg-white/10 border border-white/30 hover:border-white/60 text-white font-medium text-xs transition-colors"
                >
                  {getModeLabel()}
                </button>

                {/* Resolution & FPS */}
                <div className="text-xs font-mono text-white/70">
                  {dims.width}×{dims.height} @ {settings.frameRate}fps
                </div>

                {/* Preview FPS */}
                {recording.measuredPreviewFps > 0 && (
                  <div className="text-xs font-mono text-white/50">
                    Preview: {recording.measuredPreviewFps.toFixed(1)}fps
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Recording Indicator */}
                {recording.isRecording && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-mono text-red-400">{elapsedTime}</span>
                    </div>
                    <div className="text-xs font-mono text-white/60">
                      {recording.measuredRecordingFps.toFixed(1)}fps
                    </div>
                    {recording.droppedFrames > 0 && (
                      <div className="text-xs font-mono text-red-400">
                        -{recording.droppedFrames}
                      </div>
                    )}
                  </>
                )}

                {/* Storage */}
                {recording.storageAvailable > 0 && (
                  <div className="text-xs font-mono text-white/50">
                    {formatStorage(recording.storageAvailable)}
                  </div>
                )}

                {/* Settings */}
                <button 
                  onClick={onOpenSettings}
                  className="w-8 h-8 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Log Profile Selector - Only in log_video mode */}
          {settings.mode === 'log_video' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40">
              <div className="px-3 py-1.5 rounded bg-black/80 border border-amber-500/50 text-xs font-mono text-amber-400">
                Log curves not yet implemented
              </div>
            </div>
          )}

          {/* Left Exposure Controls */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {/* ISO */}
            <button
              onClick={() => setActiveControl(activeControl === 'iso' ? null : 'iso')}
              className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                settings.iso !== null 
                  ? 'bg-white/15 text-white border border-amber-400/60' 
                  : 'bg-black/70 text-white/80 border border-white/20 hover:border-white/40'
              }`}
            >
              <div className="text-[9px] text-white/50 mb-0.5">ISO</div>
              <div className="font-medium">{formatISO(settings.iso)}</div>
            </button>
            
            {/* Shutter */}
            <button
              onClick={() => setActiveControl(activeControl === 'shutter' ? null : 'shutter')}
              className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                settings.exposureTime !== null 
                  ? 'bg-white/15 text-white border border-amber-400/60' 
                  : 'bg-black/70 text-white/80 border border-white/20 hover:border-white/40'
              }`}
            >
              <div className="text-[9px] text-white/50 mb-0.5">SHUTTER</div>
              <div className="font-medium">{formatExposure(settings.exposureTime)}</div>
            </button>
            
            {/* White Balance */}
            <button
              onClick={() => setActiveControl(activeControl === 'wb' ? null : 'wb')}
              className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                settings.whiteBalance !== null 
                  ? 'bg-white/15 text-white border border-amber-400/60' 
                  : 'bg-black/70 text-white/80 border border-white/20 hover:border-white/40'
              }`}
            >
              <div className="text-[9px] text-white/50 mb-0.5">WB</div>
              <div className="font-medium">{formatWB(settings.whiteBalance)}</div>
            </button>
            
            {/* Focus */}
            <button
              onClick={() => setActiveControl(activeControl === 'focus' ? null : 'focus')}
              className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                settings.focusDistance !== null 
                  ? 'bg-white/15 text-white border border-amber-400/60' 
                  : 'bg-black/70 text-white/80 border border-white/20 hover:border-white/40'
              }`}
            >
              <div className="text-[9px] text-white/50 mb-0.5">FOCUS</div>
              <div className="font-medium">{settings.focusDistance !== null ? `${settings.focusDistance.toFixed(1)}m` : 'AF'}</div>
            </button>
          </div>

          {/* Control Panel */}
          {activeControl && (
            <div className="absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-lg bg-black/95 border border-white/20 backdrop-blur-sm">
              {activeControl === 'iso' && (
                <div className="w-48">
                  <label className="text-[10px] text-white/60 font-mono block mb-2">ISO / SENSITIVITY</label>
                  <input
                    type="range"
                    min="50"
                    max="3200"
                    step="50"
                    value={settings.iso ?? 400}
                    onChange={(e) => onUpdateSetting('iso', Number(e.target.value))}
                    className="w-full h-1 mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-white/40 font-mono">50</span>
                    <button 
                      onClick={() => onUpdateSetting('iso', null)}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[9px] text-white/40 font-mono">3200</span>
                  </div>
                </div>
              )}
              {activeControl === 'shutter' && (
                <div className="w-48">
                  <label className="text-[10px] text-white/60 font-mono block mb-2">EXPOSURE TIME</label>
                  <input
                    type="range"
                    min="100"
                    max="100000000"
                    step="100"
                    value={settings.exposureTime ?? 41666666}
                    onChange={(e) => onUpdateSetting('exposureTime', Number(e.target.value))}
                    className="w-full h-1 mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-white/40 font-mono">Fast</span>
                    <button 
                      onClick={() => onUpdateSetting('exposureTime', null)}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[9px] text-white/40 font-mono">Slow</span>
                  </div>
                </div>
              )}
              {activeControl === 'wb' && (
                <div className="w-48">
                  <label className="text-[10px] text-white/60 font-mono block mb-2">WHITE BALANCE</label>
                  <input
                    type="range"
                    min="2000"
                    max="8000"
                    step="100"
                    value={settings.whiteBalance ?? 5500}
                    onChange={(e) => onUpdateSetting('whiteBalance', Number(e.target.value))}
                    className="w-full h-1 mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-white/40 font-mono">2000K</span>
                    <button 
                      onClick={() => onUpdateSetting('whiteBalance', null)}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[9px] text-white/40 font-mono">8000K</span>
                  </div>
                </div>
              )}
              {activeControl === 'focus' && (
                <div className="w-48">
                  <label className="text-[10px] text-white/60 font-mono block mb-2">FOCUS DISTANCE</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={settings.focusDistance ?? 1.0}
                    onChange={(e) => onUpdateSetting('focusDistance', Number(e.target.value))}
                    className="w-full h-1 mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-white/40 font-mono">∞</span>
                    <button 
                      onClick={() => onUpdateSetting('focusDistance', null)}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AF
                    </button>
                    <span className="text-[9px] text-white/40 font-mono">0.1m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Side Controls */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {/* Zoom */}
            <div className="flex flex-col items-center gap-1 p-2 rounded bg-black/70 border border-white/20">
              <button
                onClick={() => onUpdateSetting('zoom', Math.min(settings.zoom + 0.5, 8.0))}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white text-sm"
              >
                +
              </button>
              <span className="text-[10px] font-mono text-white/90">{settings.zoom.toFixed(1)}×</span>
              <button
                onClick={() => onUpdateSetting('zoom', Math.max(settings.zoom - 0.5, 1.0))}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white text-sm"
              >
                −
              </button>
            </div>
            
            {/* Grid Toggle */}
            <button
              onClick={() => onUpdateSetting('showGrid', !settings.showGrid)}
              className={`w-9 h-9 flex items-center justify-center rounded transition-all ${
                settings.showGrid 
                  ? 'bg-white/15 border border-amber-400/60' 
                  : 'bg-black/70 border border-white/20 hover:border-white/40'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80">
                <rect x="3" y="3" width="18" height="18" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </button>
            
            {/* Diagnostics */}
            <button
              onClick={onOpenDiagnostics}
              className="w-9 h-9 flex items-center justify-center rounded bg-black/70 border border-white/20 hover:border-white/40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          {/* Bottom Shooting Dock */}
          <div className="absolute bottom-0 left-0 right-0 z-40 px-6 pb-6 pt-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            <div className="flex items-center justify-between">
              {/* RAW Still */}
              <button
                onClick={onCaptureStill}
                disabled={settings.mode === 'log_video'}
                className="w-14 h-14 rounded-full border-2 border-white/40 flex items-center justify-center hover:border-white/70 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-[9px] font-mono font-bold text-white/90">RAW</span>
                </div>
              </button>
              
              {/* Record Button */}
              <button
                onClick={recording.isRecording ? onStopRecording : onStartRecording}
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center active:scale-95 transition-all ${
                  recording.isRecording 
                    ? 'border-red-500 bg-red-500/20' 
                    : 'border-white/60 hover:border-white/90'
                }`}
              >
                {recording.isRecording ? (
                  <div className="w-8 h-8 rounded-sm bg-red-500" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-red-500" />
                )}
              </button>
              
              {/* Mode Indicator */}
              <div className="w-14 h-14 rounded-full border-2 border-white/30 flex items-center justify-center bg-black/50">
                <span className="text-[9px] font-mono font-medium text-white/70">
                  {settings.mode === 'raw' ? 'RAW' : settings.mode === 'mlv' ? 'MLV' : 'LOG'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toggle Controls */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded bg-black/70 hover:bg-black/90 text-white/60 hover:text-white/90 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {showControls ? (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a10.07 10.07 0 0 1 1.67-2.68" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a10.07 10.07 0 0 1-2.18 3.66" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          )}
        </svg>
      </button>
      
      {/* Recording Border */}
      {recording.isRecording && (
        <div className="absolute inset-0 z-30 pointer-events-none border-2 border-red-500/40" />
      )}
    </div>
  );
}
