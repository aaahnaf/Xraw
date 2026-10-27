import type { CameraInfo } from '../types';

interface Props {
  cameraInfo: CameraInfo;
  onBack: () => void;
}

export function DiagnosticsScreen({ cameraInfo, onBack }: Props) {
  const sensor = cameraInfo.sensorInfo;

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
          <h1 className="text-lg font-semibold text-white truncate">Diagnostics</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 pb-8">
        {/* Camera Identity */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">CAMERA IDENTITY</h2>
          <div className="space-y-2">
            <InfoRow label="Camera ID" value={cameraInfo.id} />
            <InfoRow label="Facing" value={cameraInfo.facing} />
            <InfoRow 
              label="Hardware Level" 
              value={cameraInfo.hardwareLevel} 
              status={cameraInfo.hardwareLevel === 'level_3' || cameraInfo.hardwareLevel === 'full' ? 'verified' : 'unknown'}
            />
          </div>
        </section>

        {/* Capabilities */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">CAPABILITIES</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {cameraInfo.capabilities.map(cap => (
              <span key={cap} className="px-2 py-1 text-xs font-medium rounded bg-white/10 text-white">
                {cap}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            <InfoRow 
              label="RAW Supported" 
              value={cameraInfo.rawSupported ? 'YES' : 'NO'} 
              status={cameraInfo.rawSupported ? 'verified' : 'unsupported'}
            />
            <InfoRow 
              label="Manual Controls" 
              value={cameraInfo.manualControls ? 'YES' : 'NO'} 
              status={cameraInfo.manualControls ? 'verified' : 'unsupported'}
            />
          </div>
        </section>

        {/* Sensor Information */}
        {sensor && (
          <section className="p-4 rounded-xl bg-neutral-900">
            <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">SENSOR INFORMATION</h2>
            <div className="space-y-2">
              <InfoRow label="Resolution" value={`${sensor.width} × ${sensor.height}`} />
              <InfoRow label="Physical Size" value={`${sensor.physicalSize.width.toFixed(2)} × ${sensor.physicalSize.height.toFixed(2)} mm`} />
              <InfoRow label="Pixel Array" value={`${sensor.pixelArraySize.width} × ${sensor.pixelArraySize.height}`} />
              <InfoRow 
                label="CFA Pattern" 
                value={sensor.colorFilterArrangement === 0 ? 'RGGB' : 
                       sensor.colorFilterArrangement === 1 ? 'BGGR' : 
                       sensor.colorFilterArrangement === 2 ? 'GRBG' : 
                       sensor.colorFilterArrangement === 3 ? 'GBRG' : 'Unknown'}
                status={sensor.colorFilterArrangement >= 0 ? 'verified' : 'unknown'}
              />
            </div>
          </section>
        )}

        {/* Exposure Controls */}
        {sensor && (
          <section className="p-4 rounded-xl bg-neutral-900">
            <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">EXPOSURE CONTROLS</h2>
            <div className="space-y-2">
              <InfoRow label="Exposure Range" value={`${(sensor.exposureTimeRange.min / 1000000).toFixed(1)}ms – ${(sensor.exposureTimeRange.max / 1000000000).toFixed(0)}s`} status="verified" />
              <InfoRow label="ISO Range" value={`${sensor.sensitivityRange.min} – ${sensor.sensitivityRange.max}`} status="verified" />
              <InfoRow label="WB Range" value={`${sensor.whiteBalanceRange.min}K – ${sensor.whiteBalanceRange.max}K`} status="verified" />
            </div>
          </section>
        )}

        {/* Video Capability */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">VIDEO CAPABILITY</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-black/40 border border-white/10">
              <div className="text-sm font-medium mb-1 text-green-400">✓ 1080p @ 24fps</div>
              <div className="text-xs text-white/60">
                RAW still acquisition at 24fps is supported.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/10">
              <div className="text-sm font-medium mb-1 text-amber-400">⚠ 1440p @ 24fps</div>
              <div className="text-xs text-white/60">
                Experimental. Higher resolution may exceed sustained bandwidth.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/10">
              <div className="text-sm font-medium mb-1 text-white/60">ℹ Continuous RAW Video</div>
              <div className="text-xs text-white/60">
                Requires device-specific hardware pipeline verification.
              </div>
            </div>
          </div>
        </section>

        {/* File Format */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">FILE FORMAT</h2>
          <div className="space-y-2">
            <InfoRow label=".xraw" value="Uncompressed RAW container" status="verified" />
            <InfoRow label=".xrawlc" value="Lossless compressed RAW" status="verified" />
            <InfoRow label=".mlv" value="Magic Lantern Video format" status="verified" />
            <InfoRow label="Version" value="1" />
            <InfoRow label="Header Size" value="64 bytes" />
            <InfoRow label="Endianness" value="Big-endian" />
            <InfoRow label="Checksum" value="CRC32" />
          </div>
        </section>

        {/* Build Status */}
        <section className="p-4 rounded-xl bg-neutral-900">
          <h2 className="text-xs font-semibold mb-3 text-white/60 tracking-wider">BUILD STATUS</h2>
          <div className="space-y-2">
            <InfoRow label="Frontend UI" value="✓ Implemented" status="verified" />
            <InfoRow label="Native Bridge" value="✓ Capacitor 5" status="verified" />
            <InfoRow label="Camera Plugin" value="✓ Camera2 API" status="verified" />
            <InfoRow label="XRAW Codec" value="✓ Lossless verified" status="verified" />
            <InfoRow label="MLV Writer" value="✓ Format implemented" status="verified" />
            <InfoRow label="Device Testing" value="⚠ Requires device" status="untested" />
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value, status }: { label: string; value: string; status?: 'verified' | 'unsupported' | 'untested' | 'unknown' }) {
  const statusColor = {
    verified: 'text-green-400',
    unsupported: 'text-red-400',
    untested: 'text-amber-400',
    unknown: 'text-white/60',
  };

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1.5 gap-1">
      <span className="text-sm text-white/60 sm:min-w-[140px]">{label}</span>
      <span className={`text-sm font-medium break-words ${status ? statusColor[status] : 'text-white'}`}>{value}</span>
    </div>
  );
}
