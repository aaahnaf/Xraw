# XRAW Camera

A minimalist, performance-focused Android camera application designed around manual control, genuine RAW image acquisition, and experimental RAW video capture.

## Overview

XRAW Camera provides direct sensor access through Android Camera2 API, manual exposure controls, and lossless RAW file output in custom `.xraw` / `.xrawlc` formats compatible with the planned XRAW Studio desktop application.

**Target Device:** Xiaomi Redmi Note 12 Pro 5G (MediaTek Dimensity 1080, Sony IMX766)

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend (Vite)           │
│  TypeScript • Tailwind CSS • Capacitor Web   │
├─────────────────────────────────────────────┤
│           Capacitor Bridge Layer             │
│     Typed Plugin Calls • Events • Errors     │
├─────────────────────────────────────────────┤
│          XRawCameraPlugin (Kotlin)           │
│   Camera2 API • ImageReader • Threading      │
├─────────────────────────────────────────────┤
│           XRawWriter / XRawLCCodec           │
│    File I/O • Lossless Compression • CRC32   │
├─────────────────────────────────────────────┤
│            Android Camera HAL                │
│         Sensor • ISP • Hardware Pipeline     │
└─────────────────────────────────────────────┘
```

## Project Structure

```
xraw-camera/
├── src/                          # React frontend
│   ├── App.tsx                   # Main application
│   ├── components/
│   │   ├── CameraScreen.tsx      # Camera viewfinder + controls
│   │   ├── DiagnosticsScreen.tsx # Camera capability diagnostics
│   │   ├── SettingsScreen.tsx    # Capture settings
│   │   └── AboutScreen.tsx       # App information
│   ├── hooks/
│   │   └── useCamera.ts          # Camera state management
│   ├── types.ts                  # TypeScript type definitions
│   └── utils/
│       └── xraw-format.ts        # XRAW format codec (JS reference)
├── android/                      # Android native project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/xraw/camera/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── XRawCameraPlugin.kt
│   │   │   │   ├── format/
│   │   │   │   │   └── XRawWriter.kt
│   │   │   │   └── service/
│   │   │   │       └── RecordingService.kt
│   │   │   └── res/
│   │   └── src/test/             # Unit tests
│   ├── xraw-camera-plugin/       # Plugin library module
│   ├── build.gradle
│   └── settings.gradle
├── .github/workflows/
│   └── build-apk.yml             # CI/CD APK build
└── README.md
```

## Prerequisites

### For Frontend Development
- Node.js 18+ and npm
- No additional tools needed for UI development

### For Android APK Build

**Option A: GitHub Actions (Recommended - No Local Setup)**
- A GitHub account
- Push this repository to GitHub
- The APK builds automatically in the cloud

**Option B: Local Build (Android Studio)**
- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34
- Android Build Tools 34.0.0
- A physical Android device or emulator (API 28+)

## Building

### Frontend Only (Web Preview)

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
```

### Android APK via GitHub Actions

1. Push this repository to GitHub
2. Go to **Actions** tab → **Build XRAW Camera APK**
3. Click **Run workflow** (or it runs automatically on push)
4. Wait for the build to complete (~5-10 minutes)
5. Download the APK from the workflow artifacts:
   - Click the completed workflow run
   - Scroll to **Artifacts** section
   - Download **XRAW-Camera-Debug-APK**

### Android APK via Android Studio (Local)

1. Open Android Studio
2. File → Open → Select the `android/` directory
3. Wait for Gradle sync to complete
4. Build → Build Bundle(s) / APK(s) → Build APK(s)
5. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Installing the APK

```bash
# Via ADB (device connected via USB)
adb install app-debug.apk

# Or transfer the APK to the device and install from file manager
```

## Features

### Implemented

- ✅ Camera enumeration and capability discovery
- ✅ Camera2 API integration (Kotlin)
- ✅ RAW still image capture
- ✅ Manual exposure controls (ISO, shutter speed)
- ✅ Manual white balance (Kelvin)
- ✅ Manual focus distance
- ✅ Digital zoom (crop region)
- ✅ Preview LUT support (preview-only, not baked into RAW)
- ✅ XRAW file format (.xraw uncompressed)
- ✅ XRAWLC lossless compression (.xrawlc)
- ✅ CRC32 integrity verification
- ✅ Recovery index checkpoints
- ✅ Bounded frame queue with overload reporting
- ✅ Thermal monitoring
- ✅ Storage space monitoring
- ✅ Foreground recording service
- ✅ Comprehensive diagnostics screen
- ✅ GitHub Actions CI/CD pipeline
- ✅ Unit tests for file format codec

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

### Not Supported

- ❌ Genuine RAW video on all devices (hardware limitation)
- ❌ Compatibility with Adobe Camera Raw / DaVinci Resolve (proprietary formats)
- ❌ Lossy compression in .xrawlc (by design — XRAWLC is lossless only)

## XRAW File Format Specification

### Header (64 bytes, Big-Endian)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | magic | 0x58524157 ("XRAW") |
| 4 | 2 | version | Format version (currently 1) |
| 6 | 2 | headerSize | Total header size (64) |
| 8 | 4 | imageWidth | Frame width in pixels |
| 12 | 4 | imageHeight | Frame height in pixels |
| 16 | 1 | sampleFormat | 0=Bayer, 1=Mono |
| 17 | 1 | bitDepth | Bits per sample (10/12/14/16) |
| 18 | 1 | packingLayout | 0=unpacked, 1=MIPI |
| 19 | 1 | cfaPattern | 0=RGGB, 1=BGGR, 2=GRBG, 3=GBRG |
| 20 | 1 | compressionId | 0=none, 1=XRAWLC |
| 21 | 1 | reserved1 | Reserved |
| 22 | 4 | frameCount | Total frames (0=streaming) |
| 26 | 4 | frameRate | FPS × 1000 |
| 30 | 8 | timestamp | Nanoseconds since epoch |
| 38 | 4 | exposureTime | Exposure in nanoseconds |
| 42 | 4 | iso | Sensor sensitivity |
| 46 | 4 | whiteBalance | Color temperature (Kelvin) |
| 50 | 4 | focusDistance | Diopters × 1000 |
| 54 | 1 | checksumAlgorithm | 0=CRC32, 1=SHA256 |
| 55 | 1 | recoveryInterval | Frames between index checkpoints |
| 56 | 2 | reserved2 | Reserved |
| 60 | 4 | headerChecksum | CRC32 of bytes 0-59 |

### Frame Record

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | magic | 0x46524D43 ("FRMC") |
| 4 | 4 | frameIndex | Sequential frame number |
| 8 | 4 | dataSize | Frame data size in bytes |
| 12 | 4 | checksum | CRC32 of frame data |
| 16 | N | data | Raw pixel data (or compressed) |

### Index Checkpoint

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | magic | 0x494E4458 ("INDX") |
| 4 | 4 | entryCount | Number of index entries |
| 8 | 12×N | entries | (frameIndex:4, offset:8) per entry |

### XRAWLC Lossless Codec

The XRAWLC codec uses:
1. **Adaptive median-edge prediction** (JPEG-LOCO algorithm)
2. **Residual computation** (difference from predicted value)
3. **16-bit signed residual packing**

This guarantees **exact reconstruction** of all original sensor samples. No information is lost.

## Camera Permissions

The app requires:
- `CAMERA` - Access to camera hardware
- `RECORD_AUDIO` - Audio recording (optional)
- `WRITE_EXTERNAL_STORAGE` - File output (Android ≤9)
- `READ_MEDIA_IMAGES/VIDEO` - Scoped storage (Android 13+)
- `FOREGROUND_SERVICE` - Keep recording during background
- `WAKE_LOCK` - Prevent sleep during recording

## Diagnostics

Open the DIAG screen from the camera view to see:
- Camera hardware level and capabilities
- Sensor information (resolution, physical size, CFA pattern)
- Supported RAW formats and sizes
- Exposure control ranges
- Video capability assessment
- File format information
- Build and test status

## Troubleshooting

### "Camera permission not granted"
- Grant camera permission when prompted
- Check Settings → Apps → XRAW Camera → Permissions

### "RAW capture not supported"
- Your device may not expose RAW_SENSOR capability
- Check diagnostics screen for supported formats
- Only RAW still capture is attempted (not video)

### Recording stops unexpectedly
- Check thermal status in diagnostics
- Verify available storage space
- Check logcat for camera errors: `adb logcat -s XRawCamera`

### Build fails
- Ensure JDK 17 is installed
- Clean build: `cd android && ./gradlew clean`
- Check Gradle wrapper version matches requirements

## Known Limitations

1. **Continuous RAW video** requires hardware-level support that varies by device. The Redmi Note 12 Pro 5G's Camera2 implementation may not sustain 24fps RAW acquisition indefinitely.

2. **RAW still capture** is the most reliable mode and works on any device with `REQUEST_AVAILABLE_CAPABILITIES_RAW`.

3. **Preview LUTs** are display-only and never affect captured data.

4. **Zoom** uses digital crop, not optical. No additional resolution is created.

5. **File format** is custom. A separate XRAW Studio application is needed to decode `.xraw`/`.xrawlc` files on Windows.

## Next Steps

1. **Build the APK** using GitHub Actions or Android Studio
2. **Install on device** and run diagnostics
3. **Test RAW still capture** to verify sensor output
4. **Test recording** and monitor thermal/frame-drop behavior
5. **Report actual device capabilities** from diagnostics screen

## License

This software is provided as-is for educational and development purposes.
