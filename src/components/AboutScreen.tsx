interface Props {
  onBack: () => void;
}

export function AboutScreen({ onBack }: Props) {
  return (
    <div className="w-full h-full bg-black text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xs font-mono text-white/70 tracking-wider uppercase">About</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* App Identity */}
        <div className="text-center space-y-2">
          <div className="text-lg font-mono text-white/90 tracking-widest">XRAW</div>
          <div className="text-[10px] font-mono text-white/40 tracking-wider">CAMERA</div>
          <div className="text-[10px] font-mono text-white/30 mt-4">Version 1.0.0-dev</div>
          <div className="text-[9px] font-mono text-white/20">Build 2026.01</div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            XRAW Camera is a minimalist, performance-focused Android camera application designed around 
            manual control, genuine RAW image acquisition, and experimental RAW video capture.
          </p>
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            Built for cinematographers and photographers who need direct sensor access, 
            manual exposure control, and lossless RAW file output compatible with XRAW Studio.
          </p>
        </div>

        {/* Architecture */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Architecture</h2>
          <div className="space-y-1">
            <ArchRow label="Frontend" value="React + TypeScript + Vite" />
            <ArchRow label="App Shell" value="Capacitor (Android)" />
            <ArchRow label="Camera API" value="Android Camera2 (Kotlin)" />
            <ArchRow label="Native Bridge" value="Capacitor Plugin" />
            <ArchRow label="File Format" value="XRAW / XRAWLC (custom)" />
            <ArchRow label="Compression" value="XRAWLC Lossless Codec" />
          </div>
        </section>

        {/* Target Device */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Target Device</h2>
          <div className="space-y-1">
            <ArchRow label="Device" value="Xiaomi Redmi Note 12 Pro 5G" />
            <ArchRow label="SoC" value="MediaTek Dimensity 1080" />
            <ArchRow label="Sensor" value="Sony IMX766 (50MP)" />
            <ArchRow label="Min Android" value="API 28 (Android 9)" />
            <ArchRow label="Target Android" value="API 34 (Android 14)" />
          </div>
        </section>

        {/* Companion */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Companion App</h2>
          <div className="space-y-1">
            <ArchRow label="XRAW Studio" value="Windows desktop RAW developer" />
            <ArchRow label="Status" value="Planned (future project)" />
            <ArchRow label="Compatibility" value="Reads .xraw and .xrawlc files" />
          </div>
        </section>

        {/* File Formats */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">File Formats</h2>
          <div className="space-y-2">
            <div className="p-2 bg-white/5 border border-white/10 rounded">
              <div className="text-[10px] font-mono text-white/70 mb-1">.xraw</div>
              <div className="text-[9px] font-mono text-white/40">
                Uncompressed RAW container. Direct sensor data with full metadata. 
                64-byte header + frame records with CRC32 checksums.
              </div>
            </div>
            <div className="p-2 bg-white/5 border border-white/10 rounded">
              <div className="text-[10px] font-mono text-white/70 mb-1">.xrawlc</div>
              <div className="text-[9px] font-mono text-white/40">
                Lossless compressed RAW. XRAWLC codec guarantees exact sample reconstruction.
                Uses adaptive median-edge prediction + entropy coding.
              </div>
            </div>
          </div>
        </section>

        {/* License */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">License</h2>
          <p className="text-[9px] font-mono text-white/30">
            This software is provided as-is for educational and development purposes.
          </p>
        </section>
      </div>
    </div>
  );
}

function ArchRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-[10px] font-mono text-white/40">{label}</span>
      <span className="text-[10px] font-mono text-white/60">{value}</span>
    </div>
  );
}
