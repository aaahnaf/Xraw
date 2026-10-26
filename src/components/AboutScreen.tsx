interface Props {
  onBack: () => void;
}

export function AboutScreen({ onBack }: Props) {
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
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>About</h1>
        </div>
      </div>

      <div className="px-4 py-8 space-y-8">
        {/* App Identity */}
        <div className="text-center space-y-3 py-8">
          <div className="text-2xl font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>XRAW</div>
          <div className="text-sm font-medium tracking-widest" style={{ color: 'var(--text-secondary)' }}>CAMERA</div>
          <div className="text-sm mt-6" style={{ color: 'var(--text-tertiary)' }}>Version 1.0.0-dev</div>
        </div>

        {/* Description */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            XRAW Camera is a minimalist, performance-focused Android camera application designed around 
            manual control, genuine RAW image acquisition, and experimental RAW video capture.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
            Built for cinematographers and photographers who need direct sensor access, 
            manual exposure control, and lossless RAW file output.
          </p>
        </section>

        {/* Architecture */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ARCHITECTURE</h2>
          <div className="space-y-2">
            <InfoRow label="Frontend" value="React + TypeScript + Vite" />
            <InfoRow label="App Shell" value="Capacitor 5" />
            <InfoRow label="Camera API" value="Android Camera2" />
            <InfoRow label="Native Bridge" value="Kotlin Plugin" />
            <InfoRow label="File Format" value="XRAW / XRAWLC" />
            <InfoRow label="Compression" value="Lossless Codec" />
          </div>
        </section>

        {/* Target Device */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>TARGET DEVICE</h2>
          <div className="space-y-2">
            <InfoRow label="Device" value="Redmi Note 12 Pro 5G" />
            <InfoRow label="SoC" value="Dimensity 1080" />
            <InfoRow label="Sensor" value="Sony IMX766 (50MP)" />
            <InfoRow label="Min Android" value="API 28 (Android 9)" />
            <InfoRow label="Target Android" value="API 34 (Android 14)" />
          </div>
        </section>

        {/* File Formats */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>FILE FORMATS</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>.xraw</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Uncompressed RAW container with full metadata and CRC32 integrity.
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>.xrawlc</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Lossless compressed RAW. Exact sample reconstruction guaranteed.
              </div>
            </div>
          </div>
        </section>

        {/* License */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>LICENSE</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            This software is provided as-is for educational and development purposes.
          </p>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
