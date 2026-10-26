import { useState, useEffect } from 'react';
import type { CaptureSettings, RecordingState, CameraInfo, LogProfile } from '../types';
import { getProfileInfo, getAvailableProfiles } from '../utils/log-profiles';
import { FocusPeakingOverlay } from './FocusPeakingOverlay';

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
    } else {
      const profile = getProfileInfo(settings.logProfile);
      return profile.name.toUpperCase();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* Native Camera Preview */}
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

      {/* Three.js Focus Peaking Overlay */}
      <FocusPeakingOverlay enabled={settings.showFocusPeaking} visible={showControls && nativeAvailable} />

      {/* Log Profile Selector - Only in log_video mode */}
      {settings.mode === 'log_video' && showControls && nativeAvailable && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40">
          <select
            value={settings.logProfile}
            onChange={(e) => onUpdateSetting('logProfile', e.target.value as LogProfile)}
            className="px-2 py-1 rounded bg-black/80 border border-white/20 text-[10px] font-mono text-white/90"
          >
            {getAvailableProfiles().filter(p => p.id !== 'none').map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name} {profile.approximate ? '(approx)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Native Unavailable */}
      {!nativeAvailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="text-center space-y-2 px-8">
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
      {showControls && nativeAvailable && (
        <>
          {/* Top Status Bar - Compact */}
          <div className="absolute top-0 left-0 right-0 z-40 px-3 py-2 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-3">
                {/* Mode Selector */}
                <button
                  onClick={() => onUpdateSetting('mode', settings.mode === 'raw' ? 'log_video' : 'raw')}
                  className="px-2 py-0.5 rounded bg-white/10 border border-white/20 hover:border-white/40 text-white/90 font-medium"
                >
                  {getModeLabel()}
                </button>
                
                {/* Resolution & FPS */}
                <span className="text-white/60">
                  {settings.resolution.width}×{settings.resolution.height} @ {settings.frameRate}fps
                </span>

                {/* Preview FPS */}
                {recording.measuredPreviewFps > 0 && (
                  <span className="text-white/40">
                    Preview: {recording.measuredPreviewFps.toFixed(1)}fps
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Recording Indicator */}
                {recording.isRecording && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400">{elapsedTime}</span>
                    <span className="text-white/40">
                      {recording.measuredRecordingFps.toFixed(1)}fps
                    </span>
                    {recording.droppedFrames > 0 && (
                      <span className="text-red-400">-{recording.droppedFrames}</span>
                    )}
                  </>
                )}

                {/* Storage */}
                {recording.storageAvailable > 0 && (
                  <span className="text-white/40">{formatStorage(recording.storageAvailable)}</span>
                )}

                {/* Settings */}
                <button 
                  onClick={onOpenSettings}
                  className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white/90"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Left Exposure Controls - Compact Strip */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1">
            {/* ISO */}
            <button
              onClick={() => setActiveControl(activeControl === 'iso' ? null : 'iso')}
              className={`px-2 py-1.5 rounded text-[10px] font-mono transition-all ${
                settings.iso !== null 
                  ? 'bg-white/10 text-white border border-amber-400/50' 
                  : 'bg-black/60 text-white/70 border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-[8px] text-white/50">ISO</div>
              <div>{formatISO(settings.iso)}</div>
            </button>
            
            {/* Shutter */}
            <button
              onClick={() => setActiveControl(activeControl === 'shutter' ? null : 'shutter')}
              className={`px-2 py-1.5 rounded text-[10px] font-mono transition-all ${
                settings.exposureTime !== null 
                  ? 'bg-white/10 text-white border border-amber-400/50' 
                  : 'bg-black/60 text-white/70 border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-[8px] text-white/50">SHUTTER</div>
              <div>{formatExposure(settings.exposureTime)}</div>
            </button>
            
            {/* White Balance */}
            <button
              onClick={() => setActiveControl(activeControl === 'wb' ? null : 'wb')}
              className={`px-2 py-1.5 rounded text-[10px] font-mono transition-all ${
                settings.whiteBalance !== null 
                  ? 'bg-white/10 text-white border border-amber-400/50' 
                  : 'bg-black/60 text-white/70 border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-[8px] text-white/50">WB</div>
              <div>{formatWB(settings.whiteBalance)}</div>
            </button>
            
            {/* Focus */}
            <button
              onClick={() => setActiveControl(activeControl === 'focus' ? null : 'focus')}
              className={`px-2 py-1.5 rounded text-[10px] font-mono transition-all ${
                settings.focusDistance !== null 
                  ? 'bg-white/10 text-white border border-amber-400/50' 
                  : 'bg-black/60 text-white/70 border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-[8px] text-white/50">FOCUS</div>
              <div>{settings.focusDistance !== null ? `${settings.focusDistance.toFixed(1)}m` : 'AF'}</div>
            </button>
          </div>

          {/* Control Panel - Compact Popup */}
          {activeControl && (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 p-3 rounded bg-black/90 border border-white/20 backdrop-blur-sm">
              {activeControl === 'iso' && (
                <div className="w-40">
                  <label className="text-[9px] text-white/50 font-mono block mb-1">ISO</label>
                  <input
                    type="range"
                    min="50"
                    max="3200"
                    step="50"
                    value={settings.iso ?? 400}
                    onChange={(e) => onUpdateSetting('iso', Number(e.target.value))}
                    className="w-full h-1 mb-1"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] text-white/40 font-mono">50</span>
                    <button 
                      onClick={() => onUpdateSetting('iso', null)}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[8px] text-white/40 font-mono">3200</span>
                  </div>
                </div>
              )}
              {activeControl === 'shutter' && (
                <div className="w-40">
                  <label className="text-[9px] text-white/50 font-mono block mb-1">EXPOSURE</label>
                  <input
                    type="range"
                    min="100"
                    max="100000000"
                    step="100"
                    value={settings.exposureTime ?? 41666666}
                    onChange={(e) => onUpdateSetting('exposureTime', Number(e.target.value))}
                    className="w-full h-1 mb-1"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] text-white/40 font-mono">Fast</span>
                    <button 
                      onClick={() => onUpdateSetting('exposureTime', null)}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[8px] text-white/40 font-mono">Slow</span>
                  </div>
                </div>
              )}
              {activeControl === 'wb' && (
                <div className="w-40">
                  <label className="text-[9px] text-white/50 font-mono block mb-1">WHITE BALANCE</label>
                  <input
                    type="range"
                    min="2000"
                    max="8000"
                    step="100"
                    value={settings.whiteBalance ?? 5500}
                    onChange={(e) => onUpdateSetting('whiteBalance', Number(e.target.value))}
                    className="w-full h-1 mb-1"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] text-white/40 font-mono">2000K</span>
                    <button 
                      onClick={() => onUpdateSetting('whiteBalance', null)}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AUTO
                    </button>
                    <span className="text-[8px] text-white/40 font-mono">8000K</span>
                  </div>
                </div>
              )}
              {activeControl === 'focus' && (
                <div className="w-40">
                  <label className="text-[9px] text-white/50 font-mono block mb-1">FOCUS DISTANCE</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={settings.focusDistance ?? 1.0}
                    onChange={(e) => onUpdateSetting('focusDistance', Number(e.target.value))}
                    className="w-full h-1 mb-1"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] text-white/40 font-mono">∞</span>
                    <button 
                      onClick={() => onUpdateSetting('focusDistance', null)}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-400 hover:bg-white/20"
                    >
                      AF
                    </button>
                    <span className="text-[8px] text-white/40 font-mono">0.1m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Side - Compact */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {/* Zoom */}
            <div className="flex flex-col items-center gap-1 p-1.5 rounded bg-black/60 border border-white/10">
              <button
                onClick={() => onUpdateSetting('zoom', Math.min(settings.zoom + 0.5, 8.0))}
                className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white text-xs"
              >
                +
              </button>
              <span className="text-[9px] font-mono text-white/80">{settings.zoom.toFixed(1)}×</span>
              <button
                onClick={() => onUpdateSetting('zoom', Math.max(settings.zoom - 0.5, 1.0))}
                className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white text-xs"
              >
                −
              </button>
            </div>
            
            {/* Grid Toggle */}
            <button
              onClick={() => onUpdateSetting('showGrid', !settings.showGrid)}
              className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                settings.showGrid 
                  ? 'bg-white/10 border border-amber-400/50' 
                  : 'bg-black/60 border border-white/10 hover:border-white/30'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
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
              className="w-8 h-8 flex items-center justify-center rounded bg-black/60 border border-white/10 hover:border-white/30"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          {/* Bottom Shooting Dock - Compact & Balanced */}
          <div className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              {/* RAW Still */}
              <button
                onClick={onCaptureStill}
                disabled={settings.mode === 'log_video'}
                className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center hover:border-white/60 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-[8px] font-mono text-white/80">RAW</span>
                </div>
              </button>
              
              {/* Record Button - Prominent */}
              <button
                onClick={recording.isRecording ? onStopRecording : onStartRecording}
                className={`w-16 h-16 rounded-full border-3 flex items-center justify-center active:scale-95 transition-all ${
                  recording.isRecording 
                    ? 'border-red-500 bg-red-500/20' 
                    : 'border-white/50 hover:border-white/80'
                }`}
                style={{ borderWidth: '3px' }}
              >
                {recording.isRecording ? (
                  <div className="w-6 h-6 rounded-sm bg-red-500" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-500" />
                )}
              </button>
              
              {/* Mode Indicator */}
              <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center bg-black/40">
                <span className="text-[8px] font-mono text-white/60">
                  {settings.mode === 'raw' ? 'RAW' : 'LOG'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toggle Controls */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-2 right-2 z-50 w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="absolute inset-0 z-30 pointer-events-none border-2 border-red-500/30" />
      )}
    </div>
  );
}
