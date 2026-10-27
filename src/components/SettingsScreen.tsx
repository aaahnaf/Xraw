import type { CaptureSettings } from '../types';

interface Props {
  settings: CaptureSettings;
  onUpdateSetting: <K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onUpdateSetting, onBack }: Props) {
  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ background: 'var(--bg-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        {/* Capture Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CAPTURE</h2>
          
          {/* Resolution */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Resolution</label>
            <div className="space-y-2">
              {[
                { id: '1080p_open_gate', label: '1920 × 1440', desc: '1080p Open Gate 4:3 (Main)' },
                { id: '2k_open_gate', label: '2560 × 1920', desc: '2K Open Gate 4:3 (High Quality)' },
                { id: '4k_open_gate', label: '3840 × 2880', desc: '4K Open Gate 4:3 (Experimental)' },
              ].map(res => (
                <button
                  key={res.id}
                  onClick={() => onUpdateSetting('resolution', res.id as any)}
                  className="w-full text-left px-4 py-3 rounded-lg transition-all"
                  style={{
                    background: settings.resolution === res.id ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                    border: `1px solid ${settings.resolution === res.id ? 'var(--accent-active)' : 'var(--border-subtle)'}`
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{res.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{res.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Frame Rate</label>
            <div className="flex gap-2">
              {[24, 25, 30].map(fps => (
                <button
                  key={fps}
                  onClick={() => onUpdateSetting('frameRate', fps)}
                  className="flex-1 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: settings.frameRate === fps ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                    border: `1px solid ${settings.frameRate === fps ? 'var(--accent-active)' : 'var(--border-subtle)'}`,
                    color: 'var(--text-primary)'
                  }}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Capture Mode Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CAPTURE MODE</h2>
          
          <div className="space-y-2">
            <button
              onClick={() => onUpdateSetting('mode', 'raw')}
              className="w-full text-left px-4 py-3 rounded-lg transition-all"
              style={{
                background: settings.mode === 'raw' ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${settings.mode === 'raw' ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>RAW</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Sensor data preservation</div>
            </button>
            
            <button
              onClick={() => onUpdateSetting('mode', 'mlv')}
              className="w-full text-left px-4 py-3 rounded-lg transition-all"
              style={{
                background: settings.mode === 'mlv' ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${settings.mode === 'mlv' ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>MLV</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Magic Lantern Video format</div>
            </button>
            
            <button
              onClick={() => onUpdateSetting('mode', 'log_video')}
              className="w-full text-left px-4 py-3 rounded-lg transition-all"
              style={{
                background: settings.mode === 'log_video' ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${settings.mode === 'log_video' ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>LOG VIDEO</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Processed video with log curve</div>
            </button>
          </div>
        </section>

        {/* RAW Format Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>RAW FORMAT</h2>
          
          <div className="space-y-2">
            <button
              onClick={() => onUpdateSetting('losslessCompression', false)}
              className="w-full text-left px-4 py-3 rounded-lg transition-all"
              style={{
                background: !settings.losslessCompression ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${!settings.losslessCompression ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>.xraw (Uncompressed)</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Larger files, faster write</div>
            </button>
            
            <button
              onClick={() => onUpdateSetting('losslessCompression', true)}
              className="w-full text-left px-4 py-3 rounded-lg transition-all"
              style={{
                background: settings.losslessCompression ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${settings.losslessCompression ? 'var(--accent-active)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>.xrawlc (Lossless)</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Compressed, exact reconstruction</div>
            </button>
          </div>
        </section>

        {/* Preview & Composition Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>PREVIEW & COMPOSITION</h2>
          
          {/* Grid Overlay */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Grid Overlay</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Rule of thirds grid</div>
            </div>
            <button
              onClick={() => onUpdateSetting('showGrid', !settings.showGrid)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: settings.showGrid ? 'var(--accent-active)' : 'var(--bg-tertiary)' }}
            >
              <div 
                className="w-5 h-5 rounded-full absolute top-0.5 transition-transform"
                style={{ 
                  background: 'var(--text-primary)',
                  transform: settings.showGrid ? 'translateX(26px)' : 'translateX(2px)'
                }}
              />
            </button>
          </div>

          {/* Preview LUT */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg mt-2" style={{ background: 'var(--bg-secondary)' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Preview LUT</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Display-only color grading</div>
            </div>
            <button
              onClick={() => onUpdateSetting('lutEnabled', !settings.lutEnabled)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: settings.lutEnabled ? 'var(--accent-active)' : 'var(--bg-tertiary)' }}
            >
              <div 
                className="w-5 h-5 rounded-full absolute top-0.5 transition-transform"
                style={{ 
                  background: 'var(--text-primary)',
                  transform: settings.lutEnabled ? 'translateX(26px)' : 'translateX(2px)'
                }}
              />
            </button>
          </div>
        </section>

        {/* Storage Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>STORAGE</h2>
          
          <div className="px-4 py-3 rounded-lg space-y-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Output Directory</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>/XRAW/</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Recovery Interval</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>48 frames</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Auto-finalize</span>
              <span className="text-sm font-medium" style={{ color: 'var(--accent-success)' }}>Enabled</span>
            </div>
          </div>
        </section>

        {/* Recording & Performance Section */}
        <section>
          <h2 className="text-sm font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>RECORDING & PERFORMANCE</h2>
          
          <div className="px-4 py-3 rounded-lg space-y-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Frame Queue</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>4 frames</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Overload Policy</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop oldest</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Background Threads</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>2</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Thermal Monitoring</span>
              <span className="text-sm font-medium" style={{ color: 'var(--accent-success)' }}>Active</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
