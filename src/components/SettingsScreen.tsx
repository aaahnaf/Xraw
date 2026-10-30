import type { CaptureSettings, RecordingResolution } from '../types';
import { getResolutionDimensions } from '../types';

interface Props {
  settings: CaptureSettings;
  onUpdateSetting: <K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onUpdateSetting, onBack }: Props) {
  return (
    <div className="w-full h-full overflow-y-auto bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 bg-neutral-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white truncate">Settings</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 pb-8">
        {/* Capture Mode Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">CAPTURE MODE</h2>
          
          <div className="space-y-2">
            <button
              onClick={() => onUpdateSetting('mode', 'raw')}
              className="w-full text-left px-4 py-3 rounded-lg transition-all bg-neutral-900 hover:bg-neutral-800"
              style={{
                border: `1px solid ${settings.mode === 'raw' ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
              }}
            >
              <div className="text-sm font-medium text-white">RAW</div>
              <div className="text-xs mt-0.5 text-red-400">⚠ NOT IMPLEMENTED - Recording is a stub</div>
              <div className="text-xs mt-0.5 text-white/60">Sensor data preservation (.xraw/.xrawlc)</div>
            </button>
            
            <button
              onClick={() => onUpdateSetting('mode', 'mlv')}
              className="w-full text-left px-4 py-3 rounded-lg transition-all bg-neutral-900 hover:bg-neutral-800"
              style={{
                border: `1px solid ${settings.mode === 'mlv' ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
              }}
            >
              <div className="text-sm font-medium text-white">MLV</div>
              <div className="text-xs mt-0.5 text-white/60">Magic Lantern Video format (.mlv)</div>
            </button>
          </div>
        </section>

        {/* Resolution Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">RESOLUTION</h2>
          <div className="space-y-2">
            {(['1080p_open_gate', '2k_open_gate', '4k_open_gate'] as RecordingResolution[]).map(res => {
              const dims = getResolutionDimensions(res);
              return (
                <button
                  key={res}
                  onClick={() => onUpdateSetting('resolution', res)}
                  className="w-full text-left px-4 py-3 rounded-lg transition-all bg-neutral-900 hover:bg-neutral-800"
                  style={{
                    border: `1px solid ${settings.resolution === res ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
                  }}
                >
                  <div className="text-sm font-medium text-white">{dims.label}</div>
                  <div className="text-xs mt-0.5 text-white/60">{dims.width}×{dims.height} {dims.aspectRatio}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Frame Rate Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">FRAME RATE</h2>
          <div className="flex gap-2">
            {[24, 25, 30].map(fps => (
              <button
                key={fps}
                onClick={() => onUpdateSetting('frameRate', fps)}
                className="flex-1 py-3 rounded-lg text-sm font-medium transition-all bg-neutral-900 hover:bg-neutral-800 text-white"
                style={{
                  border: `1px solid ${settings.frameRate === fps ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
                }}
              >
                {fps} fps
              </button>
            ))}
          </div>
        </section>

        {/* RAW Format Section - Only show in RAW mode */}
        {settings.mode === 'raw' && (
          <section>
            <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">RAW FORMAT</h2>
            
            <div className="space-y-2">
              <button
                onClick={() => onUpdateSetting('losslessCompression', false)}
                className="w-full text-left px-4 py-3 rounded-lg transition-all bg-neutral-900 hover:bg-neutral-800"
                style={{
                  border: `1px solid ${!settings.losslessCompression ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
                }}
              >
                <div className="text-sm font-medium text-white">.xraw (Uncompressed)</div>
                <div className="text-xs mt-0.5 text-white/60">Larger files, faster write</div>
              </button>
              
              <button
                onClick={() => onUpdateSetting('losslessCompression', true)}
                className="w-full text-left px-4 py-3 rounded-lg transition-all bg-neutral-900 hover:bg-neutral-800"
                style={{
                  border: `1px solid ${settings.losslessCompression ? 'rgba(212, 165, 116, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`
                }}
              >
                <div className="text-sm font-medium text-white">.xrawlc (Lossless)</div>
                <div className="text-xs mt-0.5 text-white/60">Compressed, exact reconstruction</div>
              </button>
            </div>
          </section>
        )}

        {/* Preview & Composition Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">PREVIEW & COMPOSITION</h2>
          
          {/* Grid Overlay */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-neutral-900">
            <div>
              <div className="text-sm font-medium text-white">Grid Overlay</div>
              <div className="text-xs mt-0.5 text-white/60">Rule of thirds grid</div>
            </div>
            <button
              onClick={() => onUpdateSetting('showGrid', !settings.showGrid)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: settings.showGrid ? 'rgba(212, 165, 116, 0.8)' : 'rgba(255, 255, 255, 0.1)' }}
            >
              <div 
                className="w-5 h-5 rounded-full absolute top-0.5 transition-transform bg-white"
                style={{ 
                  transform: settings.showGrid ? 'translateX(26px)' : 'translateX(2px)'
                }}
              />
            </button>
          </div>

          {/* Preview LUT */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg mt-2 bg-neutral-900">
            <div>
              <div className="text-sm font-medium text-white">Preview LUT</div>
              <div className="text-xs mt-0.5 text-white/60">Display-only color grading</div>
            </div>
            <button
              onClick={() => onUpdateSetting('lutEnabled', !settings.lutEnabled)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: settings.lutEnabled ? 'rgba(212, 165, 116, 0.8)' : 'rgba(255, 255, 255, 0.1)' }}
            >
              <div 
                className="w-5 h-5 rounded-full absolute top-0.5 transition-transform bg-white"
                style={{ 
                  transform: settings.lutEnabled ? 'translateX(26px)' : 'translateX(2px)'
                }}
              />
            </button>
          </div>
        </section>

        {/* Storage Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">STORAGE</h2>
          
          <div className="px-4 py-3 rounded-lg space-y-3 bg-neutral-900">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Output Directory</span>
              <span className="text-sm font-medium text-white">/XRAW/</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Recovery Interval</span>
              <span className="text-sm font-medium text-white">48 frames</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Auto-finalize</span>
              <span className="text-sm font-medium text-green-400">Enabled</span>
            </div>
          </div>
        </section>

        {/* Recording & Performance Section */}
        <section>
          <h2 className="text-xs font-semibold mb-3 px-1 text-white/60 tracking-wider">RECORDING & PERFORMANCE</h2>
          
          <div className="px-4 py-3 rounded-lg space-y-3 bg-neutral-900">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Frame Queue</span>
              <span className="text-sm font-medium text-white">4 frames</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Overload Policy</span>
              <span className="text-sm font-medium text-white">Drop oldest</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Background Threads</span>
              <span className="text-sm font-medium text-white">2</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Thermal Monitoring</span>
              <span className="text-sm font-medium text-green-400">Active</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
