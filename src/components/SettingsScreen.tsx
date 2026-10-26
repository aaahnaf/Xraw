import type { CaptureSettings } from '../types';

interface Props {
  settings: CaptureSettings;
  onUpdateSetting: <K extends keyof CaptureSettings>(key: K, value: CaptureSettings[K]) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onUpdateSetting, onBack }: Props) {
  return (
    <div className="w-full h-full bg-black text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xs font-mono text-white/70 tracking-wider uppercase">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Resolution */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Resolution</h2>
          <div className="space-y-1">
            {[
              { w: 1920, h: 1080, label: '1920 × 1080 (Full HD)' },
              { w: 2560, h: 1440, label: '2560 × 1440 (QHD) — EXPERIMENTAL' },
            ].map(res => (
              <button
                key={`${res.w}x${res.h}`}
                onClick={() => onUpdateSetting('resolution', { width: res.w, height: res.h })}
                className={`w-full text-left px-3 py-2 rounded text-[10px] font-mono border transition-colors ${
                  settings.resolution.width === res.w && settings.resolution.height === res.h
                    ? 'border-white/30 text-white/90 bg-white/5'
                    : 'border-white/5 text-white/40 hover:border-white/15'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
        </section>

        {/* Frame Rate */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Frame Rate</h2>
          <div className="flex gap-2">
            {[24, 25, 30].map(fps => (
              <button
                key={fps}
                onClick={() => onUpdateSetting('frameRate', fps)}
                className={`flex-1 py-2 rounded text-[10px] font-mono border transition-colors ${
                  settings.frameRate === fps
                    ? 'border-white/30 text-white/90 bg-white/5'
                    : 'border-white/5 text-white/40 hover:border-white/15'
                }`}
              >
                {fps} fps
              </button>
            ))}
          </div>
        </section>

        {/* RAW Format */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">RAW Format</h2>
          <div className="space-y-1">
            <div className="flex gap-2">
              <button
                onClick={() => onUpdateSetting('lutEnabled', false)}
                className={`flex-1 py-2 rounded text-[10px] font-mono border transition-colors ${
                  !settings.lutEnabled ? 'border-white/30 text-white/90 bg-white/5' : 'border-white/5 text-white/40'
                }`}
              >
                .xraw (uncompressed)
              </button>
              <button
                onClick={() => onUpdateSetting('lutEnabled', true)}
                className={`flex-1 py-2 rounded text-[10px] font-mono border transition-colors ${
                  settings.lutEnabled ? 'border-white/30 text-white/90 bg-white/5' : 'border-white/5 text-white/40'
                }`}
              >
                .xrawlc (lossless)
              </button>
            </div>
            <p className="text-[9px] font-mono text-white/30 mt-1">
              .xrawlc uses XRAWLC lossless compression — exact sample reconstruction guaranteed.
            </p>
          </div>
        </section>

        {/* Preview LUT */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Preview LUT</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/50">Enable Preview LUT</span>
              <button
                onClick={() => onUpdateSetting('lutEnabled', !settings.lutEnabled)}
                className={`w-8 h-4 rounded-full transition-colors ${settings.lutEnabled ? 'bg-cyan-500/50' : 'bg-white/10'}`}
              >
                <div className={`w-3 h-3 rounded-full transition-transform ${settings.lutEnabled ? 'translate-x-4 bg-cyan-400' : 'translate-x-0.5 bg-white/40'}`} />
              </button>
            </div>
            <p className="text-[9px] font-mono text-white/30">
              Preview-only. Does not affect captured RAW data. Import .cube LUT files.
            </p>
            <button className="px-3 py-1.5 text-[9px] font-mono border border-white/10 text-white/40 rounded hover:border-white/20 transition-colors">
              Import .cube LUT
            </button>
          </div>
        </section>

        {/* Storage */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Storage</h2>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Output Directory</span>
              <span className="text-white/60">/XRAW/</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Recovery Interval</span>
              <span className="text-white/60">Every 48 frames</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Auto-finalize</span>
              <span className="text-green-400">Enabled</span>
            </div>
          </div>
        </section>

        {/* Performance */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Performance</h2>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Frame Queue Size</span>
              <span className="text-white/60">4 frames (bounded)</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Overload Policy</span>
              <span className="text-white/60">Drop oldest + report</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Background Threads</span>
              <span className="text-white/60">2 (acquire + write)</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-white/40">Thermal Monitoring</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
