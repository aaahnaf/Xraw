# XRAW Camera

A minimalist, performance-focused Android camera application for genuine RAW image acquisition.

**Target Device:** Xiaomi Redmi Note 12 Pro 5G (MediaTek Dimensity 1080, Sony IMX766)

## What This Is

XRAW Camera is an Android application that provides:
- Direct sensor access through Camera2 API
- Manual exposure controls (ISO, shutter, white balance, focus)
- Genuine RAW still capture where hardware supports it
- Lossless RAW file output in custom `.xraw` / `.xrawlc` formats
- Experimental continuous RAW recording (hardware-dependent)

## Architecture

```
React Frontend (Vite/TypeScript)
         ↕ Capacitor 5 Bridge
XRawCameraPlugin (Kotlin/Camera2)
         ↕
XRawWriter / XRawLCCodec (Native I/O)
         ↕
Android Camera HAL
```

## Project Structure

```
├── src/                          # React frontend
│   ├── App.tsx                   # Main app with native detection
│   ├── components/
│   │   ├── CameraScreen.tsx      # Viewfinder + controls
│   │   ├── DiagnosticsScreen.tsx # Camera capability display
│   │   ├── SettingsScreen.tsx    # Capture settings
│   │   └── AboutScreen.tsx       # App info
│   ├── hooks/
│   │   └── useCamera.ts          # Native bridge state management
│   ├── types.ts                  # TypeScript definitions
│   └── utils/
│       ├── native-bridge.ts      # Typed Capacitor plugin bridge
│       └── xraw-format.ts        # XRAW codec reference (TS)
├── android/                      # Android native project
│   ├── app/src/main/java/com/xraw/camera/
│   │   ├── MainActivity.kt       # Capacitor bridge activity
│   │   ├── XRawCameraPlugin.kt   # Camera2 plugin (Capacitor 5)
│   │   ├── format/
│   │   │   └── XRawWriter.kt     # File writer + XRAWLC codec
│   │   └── service/
│   │       └── RecordingService.kt
│   ├── app/src/test/             # Unit tests
│   ├── build.gradle              # AGP 8.2.2, Kotlin 1.9.22
│   └── settings.gradle
├── .github/workflows/
│   └── build-apk.yml             # CI/CD APK build
├── docs/
│   └── XRAW_FORMAT_SPEC.md       # Complete format specification
└── capacitor.config.ts           # Capacitor 5 configuration
```

## Building

### Prerequisites
- Node.js 20+ and npm
- For APK: Android Studio Hedgehog+ OR GitHub account

### Frontend (Web Preview)
```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run typecheck # TypeScript validation
```

### Android APK via GitHub Actions (Recommended)

1. Push this repository to GitHub
2. Go to **Actions** tab → **Build XRAW Camera APK**
3. Click **Run workflow**
4. Wait for build (~5-10 minutes)
5. Download APK from workflow **Artifacts** section

### Android APK via Android Studio (Local)

1. Open `android/` directory in Android Studio
2. Wait for Gradle sync
3. Build → Build APK(s)
4. APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Installing
```bash
adb install app-debug.apk
```

## Features

### Implemented & Compiled
- ✅ Camera enumeration and capability discovery (Camera2)
- ✅ Native Capacitor 5 plugin bridge (typed)
- ✅ RAW still image capture (where hardware supports)
- ✅ Manual controls: ISO, shutter, WB (Kelvin), focus, zoom
- ✅ XRAW file format (.xraw uncompressed)
- ✅ XRAWLC lossless compression (.xrawlc)
- ✅ CRC32 integrity verification on all frames and header
- ✅ Recovery index checkpoints
- ✅ Bounded frame queue with overload reporting
- ✅ Thermal monitoring (PowerManager API 29+)
- ✅ Storage space monitoring
- ✅ Foreground recording service
- ✅ File validation utility (XRawReader)
- ✅ GitHub Actions CI/CD (no test suppression)
- ✅ Unit tests for format codec and round-trips

### Compiled but Not Device-Tested
- ⚠️ Continuous RAW video recording at 24fps
- ⚠️ 1440p experimental mode
- ⚠️ .cube LUT file import
- ⚠️ Real-time frame drop reporting accuracy

### Hardware-Dependent (Requires Device Verification)
- 🔍 Actual supported RAW output sizes
- 🔍 Maximum sustainable frame rate
- 🔍 Thermal behavior during sustained recording
- 🔍 Exact exposure time and ISO ranges

### Not Supported (By Design)
- ❌ Genuine continuous RAW video on all devices (hardware limitation)
- ❌ Compatibility with Adobe DNG / Camera Raw (custom format)
- ❌ Lossy compression in .xrawlc (by design — lossless only)

## Defects Fixed in This Revision

| Issue | Fix |
|-------|-----|
| Simulated camera behavior | Removed — uses real native bridge |
| `CONTROL_AWB_AVAILABLE_TEMPERATURES` type | Fixed — `Range<Integer>[]` not single `Range` |
| `CaptureRequest.SENSOR_INFO_ACTIVE_ARRAY_SIZE` | Fixed — uses `SCALER_CROP_REGION` |
| `ImageReader.Builder` API 31+ only | Fixed — uses `newInstance()` for compat |
| `System.nanoTime()` ≠ epoch nanos | Fixed — uses `currentTimeMillis * 1_000_000` |
| XRAWLC Short overflow for 16-bit | Fixed — uses `IntArray`/`Int32` residuals |
| Recording writes uncompressed when XRAWLC selected | Fixed — actually compresses |
| `finalize()` shadows `Object.finalize()` | Fixed — renamed to `finalizeFile()` |
| Image objects in queue race conditions | Fixed — queue stores byte arrays |
| `@NativePlugin` (Capacitor 3) | Fixed — `@CapacitorPlugin` (Capacitor 5) |
| `|| true` hiding test failures in CI | Fixed — tests must pass |
| Timestamp semantics mismatch | Fixed — documented as epoch nanos |

## XRAW File Format

See `docs/XRAW_FORMAT_SPEC.md` for the complete binary specification.

**Header:** 64 bytes, big-endian, CRC32 verified  
**Frames:** 16-byte header + data, each CRC32 verified  
**Index:** Checkpoints at 48-frame intervals for recovery  
**Compression:** XRAWLC uses JPEG-LOCO median-edge prediction + Int32 residuals

## Permissions

- `CAMERA` — Camera hardware access
- `RECORD_AUDIO` — Optional audio recording
- `WRITE_EXTERNAL_STORAGE` — File output (Android ≤9)
- `READ_MEDIA_IMAGES/VIDEO` — Scoped storage (Android 13+)
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CAMERA` — Recording service
- `WAKE_LOCK` — Prevent sleep during recording

## Troubleshooting

### "Native camera plugin not available"
This message appears in browser mode. Build and install the APK.

### "Camera permission not granted"
Grant permission when prompted. Check Settings → Apps → XRAW Camera.

### "RAW capture not supported"
Device lacks `RAW_SENSOR` capability. Check diagnostics screen.

### Recording stops unexpectedly
Check thermal status. Verify storage space. Check logcat: `adb logcat -s XRawCamera`

## Known Limitations

1. **Continuous RAW video** requires hardware support that varies by device
2. **Preview** uses ImageReader notifications; full display requires native SurfaceView
3. **Zoom** uses digital crop, not optical
4. **White balance** uses CIE daylight locus approximation
5. **File format** is custom — requires XRAW Studio (planned) for decoding

## Next Steps

1. Build APK via GitHub Actions or Android Studio
2. Install on device and run diagnostics
3. Test RAW still capture
4. Test recording and monitor thermal/frame-drop behavior
5. Report actual device capabilities from diagnostics

## License

This software is provided as-is for educational and development purposes.
