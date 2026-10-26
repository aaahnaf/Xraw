# XRAW Camera - Build Guide

## Quick Start: Get the APK

### Option 1: GitHub Actions (Recommended)

1. **Push this repository to GitHub**
   ```bash
   git init
   git add .
   git commit -m "XRAW Camera - complete implementation"
   git remote add origin https://github.com/YOUR_USERNAME/xraw-camera.git
   git push -u origin main
   ```

2. **Trigger the build workflow**
   - Go to your repository on GitHub
   - Click the **Actions** tab
   - Click **"Build XRAW Camera APK"**
   - Click **"Run workflow"** → **"Run workflow"**

3. **Wait for build** (~5-10 minutes)

4. **Download the APK**
   - Click the completed workflow run
   - Scroll to **Artifacts** section
   - Click **XRAW-Camera-Debug-APK**
   - Extract `app-debug.apk`

5. **Install on your Android device**
   ```bash
   adb install app-debug.apk
   ```
   Or transfer the APK to your device and install from file manager.

### Option 2: Local Build with Android Studio

1. **Install Android Studio** (Hedgehog 2023.1.1 or later)

2. **Open the project**
   - File → Open → Select the `android/` directory
   - Wait for Gradle sync to complete

3. **Build the APK**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Wait for build to complete

4. **Find the APK**
   - Location: `android/app/build/outputs/apk/debug/app-debug.apk`

5. **Install on device**
   ```bash
   adb install app-debug.apk
   ```

## Prerequisites

### For GitHub Actions Build
- GitHub account
- Git installed locally

### For Local Build
- Android Studio Hedgehog (2023.1.1) or later
- JDK 17 (included with Android Studio)
- Android SDK 34 (installed via Android Studio)
- Android Build Tools 34.0.0
- Physical Android device or emulator (API 28+)

## Project Structure

```
xraw-camera/
├── src/                          # React frontend
│   ├── App.tsx                   # Main app
│   ├── components/
│   │   ├── CameraScreen.tsx      # Camera UI (transparent overlay)
│   │   ├── DiagnosticsScreen.tsx # Camera diagnostics
│   │   ├── SettingsScreen.tsx    # Settings
│   │   └── AboutScreen.tsx       # About
│   ├── hooks/
│   │   └── useCamera.ts          # Native bridge state
│   ├── types.ts                  # TypeScript types
│   └── utils/
│       ├── native-bridge.ts      # Capacitor plugin bridge
│       └── xraw-format.ts        # XRAW codec (TypeScript)
├── android/                      # Android native project
│   ├── app/src/main/java/com/xraw/camera/
│   │   ├── MainActivity.kt       # Capacitor activity
│   │   ├── CameraPreviewView.kt  # Native camera preview
│   │   ├── XRawCameraPlugin.kt   # Camera2 plugin
│   │   ├── format/
│   │   │   └── XRawWriter.kt     # File writer + XRAWLC codec
│   │   └── service/
│   │       └── RecordingService.kt
│   ├── app/src/test/             # Unit tests
│   └── gradle/                   # Gradle wrapper
├── .github/workflows/
│   └── build-apk.yml             # CI/CD workflow
└── docs/
    └── XRAW_FORMAT_SPEC.md       # File format specification
```

## Architecture

### Native Preview
The app uses a **native TextureView** (`CameraPreviewView.kt`) for camera preview:
- Camera2 API renders directly to the TextureView surface
- React UI overlays transparently via Capacitor WebView
- No frame data transmitted through JavaScript
- Efficient, low-latency preview

### Capacitor Bridge
- Frontend: React + TypeScript + Vite
- Native: Kotlin + Camera2 API
- Bridge: Capacitor 5 plugin (`XRawCameraPlugin.kt`)
- All camera operations go through typed native bridge

### File Format
- `.xraw` — Uncompressed RAW container
- `.xrawlc` — Lossless compressed RAW (XRAWLC codec)
- CRC32 integrity verification on all frames
- Recovery index checkpoints every 48 frames

## Testing on Device

### First Launch
1. Open XRAW Camera app
2. Grant camera permission when prompted
3. Camera preview should show live imagery
4. Open **DIAG** screen to see camera capabilities

### Test RAW Still Capture
1. Tap the **RAW** button (left side)
2. Check for success message with file details
3. File saved to: `/sdcard/Android/data/com.xraw.camera.debug/files/XRAW/`

### Test Recording
1. Tap the **red circle** button (center)
2. Recording starts, timer appears
3. Tap again to stop
4. Check frame count and dropped frames
5. File saved to same XRAW directory

### Check Diagnostics
Open **DIAG** screen to see:
- Camera hardware level
- Supported RAW formats and sizes
- Exposure control ranges
- Sensor information
- Build status

## Troubleshooting

### "Native camera plugin not available"
- You're running in browser mode
- Build and install the APK

### "Camera permission not granted"
- Grant permission when prompted
- Check Settings → Apps → XRAW Camera → Permissions

### "RAW capture not supported"
- Device lacks RAW_SENSOR capability
- Check diagnostics screen for supported formats

### Preview not showing
- Check that camera permission is granted
- Restart the app
- Check logcat: `adb logcat -s XRawCamera`

### Recording stops unexpectedly
- Check thermal status in diagnostics
- Verify available storage space
- Check logcat for errors

### Build fails
- Ensure JDK 17 is installed
- Clean build: `cd android && ./gradlew clean`
- Check Gradle wrapper version

## Known Limitations

### Hardware-Dependent
- **Continuous RAW video** — Requires device support (varies by hardware)
- **Maximum frame rate** — Depends on sensor and ISP capabilities
- **Thermal behavior** — Device-specific during sustained recording

### Implementation
- **Zoom** — Digital crop, not optical
- **White balance** — CIE daylight locus approximation
- **File format** — Custom XRAW/XRAWLC (requires dedicated decoder)

### Target Device: Xiaomi Redmi Note 12 Pro 5G
- SoC: MediaTek Dimensity 1080
- Sensor: Sony IMX766 (50MP)
- Expected RAW support: Yes
- Expected max RAW FPS: ~24fps at full resolution (hardware-dependent)

## Development

### Frontend Development
```bash
npm install
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run typecheck # TypeScript validation
```

### Android Development
```bash
cd android
./gradlew assembleDebug    # Build debug APK
./gradlew test             # Run unit tests
./gradlew clean            # Clean build
```

## File Format Specification

See `docs/XRAW_FORMAT_SPEC.md` for complete binary format specification.

**Key points:**
- 64-byte header with CRC32 verification
- Frame records with individual CRC32 checksums
- Index checkpoints for recovery
- XRAWLC uses JPEG-LOCO median-edge prediction
- Int32 residuals (no overflow for 16-bit data)
- Exact lossless reconstruction guaranteed

## Support

For issues or questions:
1. Check the diagnostics screen
2. Review logcat output
3. Verify device capabilities
4. Check the file format specification

## License

This software is provided as-is for educational and development purposes.
