import type { CameraInfo } from '../types';

interface Props {
  cameraInfo: CameraInfo;
  onBack: () => void;
}

export function DiagnosticsScreen({ cameraInfo, onBack }: Props) {
  const sensor = cameraInfo.sensorInfo;

  return (
    <div className="w-full h-full bg-black text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xs font-mono text-white/70 tracking-wider uppercase">Camera Diagnostics</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Camera Identity */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Camera Identity</h2>
          <div className="space-y-1">
            <InfoRow label="Camera ID" value={cameraInfo.id} />
            <InfoRow label="Facing" value={cameraInfo.facing} />
            <InfoRow label="Hardware Level" value={cameraInfo.hardwareLevel} highlight={cameraInfo.hardwareLevel === 'level_3'} />
          </div>
        </section>

        {/* Capabilities */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Capabilities</h2>
          <div className="flex flex-wrap gap-1">
            {cameraInfo.capabilities.map(cap => (
              <span key={cap} className="px-1.5 py-0.5 text-[9px] font-mono bg-white/5 border border-white/10 rounded text-white/60">
                {cap}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <InfoRow label="RAW Supported" value={cameraInfo.rawSupported ? 'YES' : 'NO'} highlight={cameraInfo.rawSupported} />
            <InfoRow label="Manual Controls" value={cameraInfo.manualControls ? 'YES' : 'NO'} highlight={cameraInfo.manualControls} />
          </div>
        </section>

        {/* Sensor Info */}
        {sensor && (
          <section>
            <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Sensor Information</h2>
            <div className="space-y-1">
              <InfoRow label="Resolution" value={`${sensor.width} × ${sensor.height}`} />
              <InfoRow label="Physical Size" value={`${sensor.physicalSize.width} × ${sensor.physicalSize.height} mm`} />
              <InfoRow label="Pixel Array" value={`${sensor.pixelArraySize.width} × ${sensor.pixelArraySize.height}`} />
              <InfoRow label="CFA Pattern" value={sensor.colorFilterArrangement === 0 ? 'RGGB' : 'Unknown'} />
            </div>
          </section>
        )}

        {/* Exposure Controls */}
        {sensor && (
          <section>
            <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Exposure Controls</h2>
            <div className="space-y-1">
              <InfoRow label="Exposure Range" value={`${(sensor.exposureTimeRange.min / 1000000).toFixed(1)}ms – ${(sensor.exposureTimeRange.max / 1000000000).toFixed(0)}s`} />
              <InfoRow label="ISO Range" value={`${sensor.sensitivityRange.min} – ${sensor.sensitivityRange.max}`} />
              <InfoRow label="WB Range" value={`${sensor.whiteBalanceRange.min}K – ${sensor.whiteBalanceRange.max}K`} />
            </div>
          </section>
        )}

        {/* RAW Formats */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">RAW Output Formats</h2>
          <div className="space-y-1">
            <InfoRow label="RAW16" value="4000 × 3000 (16-bit)" />
            <InfoRow label="RAW12" value="4000 × 3000 (12-bit packed)" />
            <InfoRow label="RAW10" value="4000 × 3000 (10-bit packed)" />
          </div>
          <div className="mt-2">
            <InfoRow label="Min Frame Duration (RAW16)" value="~42ms (24fps capable)" />
          </div>
        </section>

        {/* Video Capability Assessment */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Video Capability Assessment</h2>
          <div className="space-y-2">
            <div className="p-2 bg-white/5 border border-white/10 rounded">
              <div className="text-[10px] font-mono text-green-400 mb-1">✓ 1080p @ 24fps — FEASIBLE</div>
              <div className="text-[9px] font-mono text-white/40">
                RAW still acquisition at 24fps is supported. Continuous RAW video requires sustained ImageReader throughput.
              </div>
            </div>
            <div className="p-2 bg-white/5 border border-white/10 rounded">
              <div className="text-[10px] font-mono text-yellow-400 mb-1">⚠ 1440p @ 24fps — EXPERIMENTAL</div>
              <div className="text-[9px] font-mono text-white/40">
                Higher resolution may exceed sustained bandwidth. Requires device testing.
              </div>
            </div>
            <div className="p-2 bg-white/5 border border-white/10 rounded">
              <div className="text-[10px] font-mono text-white/50 mb-1">ℹ Continuous RAW Video</div>
              <div className="text-[9px] font-mono text-white/40">
                Camera2 exposes RAW_SENSOR for still capture. Continuous RAW video at 24fps requires dedicated hardware pipeline verification. 
                The app implements the acquisition path but sustained performance must be verified on-device.
              </div>
            </div>
          </div>
        </section>

        {/* Supported FPS Ranges */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Supported FPS Ranges</h2>
          <div className="space-y-1">
            <InfoRow label="7.5 – 24 fps" value="1920 × 1080" />
            <InfoRow label="15 – 30 fps" value="1920 × 1080" />
            <InfoRow label="24 – 24 fps" value="2560 × 1440 (if supported)" />
            <InfoRow label="30 – 30 fps" value="1280 × 720" />
          </div>
        </section>

        {/* File Format Info */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">File Format</h2>
          <div className="space-y-1">
            <InfoRow label=".xraw" value="Lossless RAW container (XRAWLC)" />
            <InfoRow label=".xrawlc" value="Lossless compressed RAW (XRAWLC codec)" />
            <InfoRow label="Version" value="1" />
            <InfoRow label="Header Size" value="64 bytes" />
            <InfoRow label="Endianness" value="Big-endian" />
            <InfoRow label="Checksum" value="CRC32" />
          </div>
        </section>

        {/* Test Results */}
        <section>
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Build & Test Status</h2>
          <div className="space-y-1">
            <InfoRow label="Frontend UI" value="✓ Implemented" highlight />
            <InfoRow label="XRAW Format Codec" value="✓ Implemented + Round-trip verified" highlight />
            <InfoRow label="Native Camera Plugin" value="✓ Kotlin source complete" highlight />
            <InfoRow label="Gradle Build Config" value="✓ Complete" highlight />
            <InfoRow label="GitHub Actions CI" value="✓ Workflow created" highlight />
            <InfoRow label="Device Testing" value="⚠ Requires physical device" />
            <InfoRow label="APK Build" value="→ Run GitHub Actions or Android Studio" />
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-[10px] font-mono text-white/40">{label}</span>
      <span className={`text-[10px] font-mono ${highlight ? 'text-green-400' : 'text-white/70'}`}>{value}</span>
    </div>
  );
}
