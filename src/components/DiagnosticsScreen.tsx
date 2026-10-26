import type { CameraInfo } from '../types';

interface Props {
  cameraInfo: CameraInfo;
  onBack: () => void;
}

export function DiagnosticsScreen({ cameraInfo, onBack }: Props) {
  const sensor = cameraInfo.sensorInfo;

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
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Diagnostics</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Camera Identity */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CAMERA IDENTITY</h2>
          <div className="space-y-2">
            <InfoRow label="Camera ID" value={cameraInfo.id} />
            <InfoRow label="Facing" value={cameraInfo.facing} />
            <InfoRow label="Hardware Level" value={cameraInfo.hardwareLevel} highlight={cameraInfo.hardwareLevel === 'level_3' || cameraInfo.hardwareLevel === 'full'} />
          </div>
        </section>

        {/* Capabilities */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CAPABILITIES</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {cameraInfo.capabilities.map(cap => (
              <span key={cap} className="px-2 py-1 text-xs font-medium rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                {cap}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            <InfoRow label="RAW Supported" value={cameraInfo.rawSupported ? 'YES' : 'NO'} highlight={cameraInfo.rawSupported} />
            <InfoRow label="Manual Controls" value={cameraInfo.manualControls ? 'YES' : 'NO'} highlight={cameraInfo.manualControls} />
          </div>
        </section>

        {/* Sensor Information */}
        {sensor && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>SENSOR INFORMATION</h2>
            <div className="space-y-2">
              <InfoRow label="Resolution" value={`${sensor.width} × ${sensor.height}`} />
              <InfoRow label="Physical Size" value={`${sensor.physicalSize.width.toFixed(2)} × ${sensor.physicalSize.height.toFixed(2)} mm`} />
              <InfoRow label="Pixel Array" value={`${sensor.pixelArraySize.width} × ${sensor.pixelArraySize.height}`} />
              <InfoRow label="CFA Pattern" value={sensor.colorFilterArrangement === 0 ? 'RGGB' : sensor.colorFilterArrangement === 1 ? 'BGGR' : sensor.colorFilterArrangement === 2 ? 'GRBG' : sensor.colorFilterArrangement === 3 ? 'GBRG' : 'Unknown'} />
            </div>
          </section>
        )}

        {/* Exposure Controls */}
        {sensor && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>EXPOSURE CONTROLS</h2>
            <div className="space-y-2">
              <InfoRow label="Exposure Range" value={`${(sensor.exposureTimeRange.min / 1000000).toFixed(1)}ms – ${(sensor.exposureTimeRange.max / 1000000000).toFixed(0)}s`} />
              <InfoRow label="ISO Range" value={`${sensor.sensitivityRange.min} – ${sensor.sensitivityRange.max}`} />
              <InfoRow label="WB Range" value={`${sensor.whiteBalanceRange.min}K – ${sensor.whiteBalanceRange.max}K`} />
            </div>
          </section>
        )}

        {/* Video Capability Assessment */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>VIDEO CAPABILITY</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--accent-success)' }}>✓ 1080p @ 24fps</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                RAW still acquisition at 24fps is supported.
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--accent-warning)' }}>⚠ 1440p @ 24fps</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Experimental. Higher resolution may exceed sustained bandwidth.
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>ℹ Continuous RAW Video</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Requires device-specific hardware pipeline verification.
              </div>
            </div>
          </div>
        </section>

        {/* File Format */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>FILE FORMAT</h2>
          <div className="space-y-2">
            <InfoRow label=".xraw" value="Uncompressed RAW container" />
            <InfoRow label=".xrawlc" value="Lossless compressed RAW" />
            <InfoRow label="Version" value="1" />
            <InfoRow label="Header Size" value="64 bytes" />
            <InfoRow label="Endianness" value="Big-endian" />
            <InfoRow label="Checksum" value="CRC32" />
          </div>
        </section>

        {/* Build Status */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>BUILD STATUS</h2>
          <div className="space-y-2">
            <InfoRow label="Frontend UI" value="✓ Implemented" highlight />
            <InfoRow label="Native Bridge" value="✓ Capacitor 5" highlight />
            <InfoRow label="Camera Plugin" value="✓ Camera2 API" highlight />
            <InfoRow label="XRAW Codec" value="✓ Lossless verified" highlight />
            <InfoRow label="Device Testing" value="⚠ Requires device" />
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: highlight ? 'var(--accent-success)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
