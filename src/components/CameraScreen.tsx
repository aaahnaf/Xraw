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
  const [activeControl, setActiveControl] = useState<string | null>(null);

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

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: 'var(--bg-primary)' }}>
      {/* Native Camera Preview - transparent overlay */}
      <div className="absolute inset-0 bg-transparent" />
      
      {/* Grid Overlay */}
      {settings.showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white/10" />
            ))}
          </div>
        </div>
      )}
      
      {/* Native Unavailable Overlay */}
      {!nativeAvailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-center space-y-4 px-8">
            <div className="text-lg font-medium" style={{ color: 'var(--accent-warning)' }}>
              Camera Unavailable
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Native plugin required. Install the Android APK.
            </div>
          </div>
        </div>
      )}
      
      {/* Preview not active indicator */}
      {nativeAvailable && !previewActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(10, 10, 10, 0.8)' }}>
          <div className="text-center space-y-3 px-8">
            <div className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Preview Not Active
            </div>
          </div>
        </div>
      )}

      {/* Controls Layer */}
      {showControls && nativeAvailable && (
        <>
          {/* Top Status Bar */}
          <div className="absolute top-0 left-0 right-0 z-40 px-4 py-3" style={{ background: 'linear-gradient(to bottom, rgba(10, 10, 10, 0.9) 0%, transparent 100%)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Resolution & FPS */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {settings.resolution.width}×{settings.resolution.height}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {settings.frameRate}fps
                  </span>
                </div>
                
                {/* Recording Indicator */}
                {recording.isRecording && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full recording-indicator" style={{ background: 'var(--accent-recording)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--accent-recording)' }}>
                      REC
                    </span>
                    <span className="text-sm font-mono" style={{ color: 'var(--accent-recording)' }}>
                      {elapsedTime}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Storage */}
                {recording.storageAvailable > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {formatStorage(recording.storageAvailable)}
                  </span>
                )}
                
                {/* Thermal Warning */}
                {recording.thermalStatus !== 'normal' && (
                  <span className="text-xs font-medium" style={{ 
                    color: recording.thermalStatus === 'mild' ? 'var(--accent-warning)' : 
                           recording.thermalStatus === 'severe' ? 'var(--accent-recording)' : 'var(--accent-recording)'
                  }}>
                    ⚠
                  </span>
                )}
                
                {/* Settings Button */}
                <button 
                  onClick={onOpenSettings}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Exposure Control Strip */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {/* ISO */}
            <button
              onClick={() => setActiveControl(activeControl === 'iso' ? null : 'iso')}
              className="px-3 py-2 rounded-lg transition-all"
              style={{ 
                background: settings.iso !== null ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                border: `1px solid ${settings.iso !== null ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>ISO</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatISO(settings.iso)}
              </div>
            </button>
            
            {/* Shutter */}
            <button
              onClick={() => setActiveControl(activeControl === 'shutter' ? null : 'shutter')}
              className="px-3 py-2 rounded-lg transition-all"
              style={{ 
                background: settings.exposureTime !== null ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                border: `1px solid ${settings.exposureTime !== null ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>SHUTTER</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatExposure(settings.exposureTime)}
              </div>
            </button>
            
            {/* White Balance */}
            <button
              onClick={() => setActiveControl(activeControl === 'wb' ? null : 'wb')}
              className="px-3 py-2 rounded-lg transition-all"
              style={{ 
                background: settings.whiteBalance !== null ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                border: `1px solid ${settings.whiteBalance !== null ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>WB</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatWB(settings.whiteBalance)}
              </div>
            </button>
            
            {/* Focus */}
            <button
              onClick={() => setActiveControl(activeControl === 'focus' ? null : 'focus')}
              className="px-3 py-2 rounded-lg transition-all"
              style={{ 
                background: settings.focusDistance !== null ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                border: `1px solid ${settings.focusDistance !== null ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>FOCUS</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {settings.focusDistance !== null ? `${settings.focusDistance.toFixed(1)}m` : 'AF'}
              </div>
            </button>
          </div>

          {/* Control Panel */}
          {activeControl && (
            <div className="absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }}>
              {activeControl === 'iso' && (
                <div className="w-48">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>ISO / SENSITIVITY</label>
                  <input
                    type="range"
                    min="50"
                    max="3200"
                    step="50"
                    value={settings.iso ?? 400}
                    onChange={(e) => onUpdateSetting('iso', Number(e.target.value))}
                    className="w-full mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>50</span>
                    <button 
                      onClick={() => onUpdateSetting('iso', null)}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: 'var(--accent-active)', background: 'var(--bg-tertiary)' }}
                    >
                      AUTO
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>3200</span>
                  </div>
                </div>
              )}
              {activeControl === 'shutter' && (
                <div className="w-48">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>EXPOSURE TIME</label>
                  <input
                    type="range"
                    min="100"
                    max="100000000"
                    step="100"
                    value={settings.exposureTime ?? 41666666}
                    onChange={(e) => onUpdateSetting('exposureTime', Number(e.target.value))}
                    className="w-full mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Fast</span>
                    <button 
                      onClick={() => onUpdateSetting('exposureTime', null)}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: 'var(--accent-active)', background: 'var(--bg-tertiary)' }}
                    >
                      AUTO
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Slow</span>
                  </div>
                </div>
              )}
              {activeControl === 'wb' && (
                <div className="w-48">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>WHITE BALANCE</label>
                  <input
                    type="range"
                    min="2000"
                    max="8000"
                    step="100"
                    value={settings.whiteBalance ?? 5500}
                    onChange={(e) => onUpdateSetting('whiteBalance', Number(e.target.value))}
                    className="w-full mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>2000K</span>
                    <button 
                      onClick={() => onUpdateSetting('whiteBalance', null)}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: 'var(--accent-active)', background: 'var(--bg-tertiary)' }}
                    >
                      AUTO
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>8000K</span>
                  </div>
                </div>
              )}
              {activeControl === 'focus' && (
                <div className="w-48">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>FOCUS DISTANCE</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={settings.focusDistance ?? 1.0}
                    onChange={(e) => onUpdateSetting('focusDistance', Number(e.target.value))}
                    className="w-full mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>∞</span>
                    <button 
                      onClick={() => onUpdateSetting('focusDistance', null)}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: 'var(--accent-active)', background: 'var(--bg-tertiary)' }}
                    >
                      AF
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>0.1m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Side Controls */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
            {/* Zoom */}
            <div className="flex flex-col items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <button
                onClick={() => onUpdateSetting('zoom', Math.min(settings.zoom + 0.5, 8.0))}
                className="w-8 h-8 flex items-center justify-center rounded transition-colors"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                +
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {settings.zoom.toFixed(1)}×
              </span>
              <button
                onClick={() => onUpdateSetting('zoom', Math.max(settings.zoom - 0.5, 1.0))}
                className="w-8 h-8 flex items-center justify-center rounded transition-colors"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                −
              </button>
            </div>
            
            {/* Grid Toggle */}
            <button
              onClick={() => onUpdateSetting('showGrid', !settings.showGrid)}
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ 
                background: settings.showGrid ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                border: `1px solid ${settings.showGrid ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}>
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
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          {/* Bottom Shooting Dock */}
          <div className="absolute bottom-0 left-0 right-0 z-40 px-6 pb-6 pt-4" style={{ background: 'linear-gradient(to top, rgba(10, 10, 10, 0.95) 0%, transparent 100%)' }}>
            <div className="flex items-center justify-between">
              {/* RAW Still Button */}
              <button
                onClick={onCaptureStill}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ 
                  background: 'var(--bg-tertiary)',
                  border: '2px solid var(--border-medium)'
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>RAW</span>
                </div>
              </button>
              
              {/* Record Button */}
              <button
                onClick={recording.isRecording ? onStopRecording : onStartRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ 
                  background: recording.isRecording ? 'var(--accent-recording)' : 'var(--bg-tertiary)',
                  border: `3px solid ${recording.isRecording ? 'var(--accent-recording)' : 'var(--text-primary)'}`
                }}
              >
                {recording.isRecording ? (
                  <div className="w-8 h-8 rounded-sm" style={{ background: 'var(--bg-primary)' }} />
                ) : (
                  <div className="w-14 h-14 rounded-full" style={{ background: 'var(--accent-recording)' }} />
                )}
              </button>
              
              {/* Format Indicator */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--border-subtle)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {settings.losslessCompression ? 'LC' : 'RAW'}
                </span>
              </div>
            </div>
            
            {/* Recording Stats */}
            {recording.isRecording && (
              <div className="mt-3 flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Frames</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{recording.frameCount}</div>
                </div>
                {recording.droppedFrames > 0 && (
                  <div className="text-center">
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dropped</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--accent-recording)' }}>{recording.droppedFrames}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Size</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatStorage(recording.currentFileSize)}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}>
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
      
      {/* Recording border indicator */}
      {recording.isRecording && (
        <div className="absolute inset-0 z-30 pointer-events-none border-2 rounded-sm" style={{ borderColor: 'var(--accent-recording)', opacity: 0.3 }} />
      )}
    </div>
  );
}
