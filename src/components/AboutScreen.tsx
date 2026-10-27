interface Props {
  onBack: () => void;
}

export function AboutScreen({ onBack }: Props) {
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
          <h1 className="text-lg font-semibold text-white truncate">About</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 pb-8">
        {/* App Identity */}
        <div className="text-center space-y-3 py-8">
          <div className="text-2xl font-bold tracking-wider text-white">XRAW</div>
          <div className="text-sm font-medium tracking-widest text-white/60">CAMERA</div>
          <div className="text-sm mt-6 text-white/40">Version 1.0.0-dev</div>
        </div>

        {/* Description */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <p className="text-sm leading-relaxed text-white/70">
            XRAW Camera is a minimalist, performance-focused Android camera application designed around 
            manual control, genuine RAW image acquisition, and experimental RAW video capture.
          </p>
          <p className="text-sm leading-relaxed mt-3 text-white/70">
            Built for cinematographers and photographers who need direct sensor access, 
            manual exposure control, and lossless RAW file output.
          </p>
        </section>

        {/* Architecture */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">ARCHITECTURE</h2>
          <div className="space-y-2">
            <InfoRow label="Frontend" value="React + TypeScript + Vite" />
            <InfoRow label="App Shell" value="Capacitor 5" />
            <InfoRow label="Camera API" value="Android Camera2" />
            <InfoRow label="Native Bridge" value="Kotlin Plugin" />
            <InfoRow label="File Formats" value="XRAW / XRAWLC / MLV" />
            <InfoRow label="Compression" value="Lossless Codec" />
          </div>
        </section>

        {/* Target Device */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">TARGET DEVICE</h2>
          <div className="space-y-2">
            <InfoRow label="Device" value="Redmi Note 12 Pro 5G" />
            <InfoRow label="SoC" value="Dimensity 1080" />
            <InfoRow label="Sensor" value="Sony IMX766 (50MP)" />
            <InfoRow label="Min Android" value="API 28 (Android 9)" />
            <InfoRow label="Target Android" value="API 34 (Android 14)" />
          </div>
        </section>

        {/* File Formats */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">FILE FORMATS</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-black/40">
              <div className="text-sm font-medium mb-1 text-white">.xraw</div>
              <div className="text-xs text-white/60">
                Uncompressed RAW container with full metadata and CRC32 integrity.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40">
              <div className="text-sm font-medium mb-1 text-white">.xrawlc</div>
              <div className="text-xs text-white/60">
                Lossless compressed RAW. Exact sample reconstruction guaranteed.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40">
              <div className="text-sm font-medium mb-1 text-white">.mlv</div>
              <div className="text-xs text-white/60">
                Magic Lantern Video format. Compatible with MLV App.
              </div>
            </div>
          </div>
        </section>

        {/* License */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">LICENSE</h2>
          <p className="text-xs text-white/40">
            This software is provided as-is for educational and development purposes.
          </p>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1.5 gap-1">
      <span className="text-sm text-white/60 sm:text-right sm:min-w-[120px]">{label}</span>
      <span className="text-sm font-medium text-white break-words">{value}</span>
    </div>
  );
}
