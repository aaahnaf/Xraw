# XRAW Camera - Redmi Note 12 Pro 5G Optimization & MLV Recording

## Overview

This implementation adds comprehensive support for the Xiaomi Redmi Note 12 Pro 5G with MLV (Magic Lantern Video) recording capabilities, optimized for 24 FPS open-gate 4:3 recording.

## Key Features Implemented

### 1. MLV Format Support
- **New file**: `android/app/src/main/java/com/xraw/camera/format/MlvWriter.kt`
- Implements the Magic Lantern Video format compatible with MLV App
- Supports RAW sensor data preservation
- Includes proper metadata blocks (MLVI, RAWI, EXPO, WBAL, RTC, IDNT, VIDF, INDX)
- 64-byte block alignment for optimal storage performance
- Frame indexing for recovery and playback

### 2. Open-Gate 4:3 Recording Modes
Three resolution modes optimized for full sensor coverage:

- **1080p Open Gate** (1920×1440) - Main mode, 4:3 aspect ratio
- **2K Open Gate** (2560×1920) - High quality mode, 4:3 aspect ratio  
- **4K Open Gate** (3840×2880) - Experimental mode, 4:3 aspect ratio

All modes preserve the full sensor field of view without cropping.

### 3. Optimized Recording Pipeline for 24 FPS
- Bounded frame queue (MAX_FRAME_QUEUE_SIZE = 4) to prevent memory issues
- Separate writer thread for non-blocking frame processing
- Efficient buffer management with preallocated byte arrays
- Frame drop detection and reporting
- Real-time FPS measurement and diagnostics

### 4. UFS 2.1 Storage Optimization
- Sequential file writes with buffered output
- 64-byte aligned blocks for optimal flash storage performance
- Periodic index checkpoints for recovery
- Minimal flush operations to reduce write amplification

### 5. Three Capture Modes
- **RAW Mode**: Direct sensor data preservation (.xraw/.xrawlc)
- **MLV Mode**: Magic Lantern Video format (.mlv)
- **LOG VIDEO Mode**: Processed video with log curves (.mp4)

### 6. Real-Time Diagnostics
- Measured preview FPS
- Measured recording FPS
- Dropped frame counter
- Storage throughput monitoring
- Thermal status tracking

## Technical Implementation

### Frontend Changes

#### Type System Updates (`src/types.ts`)
```typescript
export type CaptureMode = 'raw' | 'log_video' | 'mlv';

export type RecordingResolution = 
  | '1080p_open_gate'  // 1920x1440 4:3
  | '2k_open_gate'     // 2560x1920 4:3
  | '4k_open_gate';    // 3840x2880 4:3

export function getResolutionDimensions(resolution: RecordingResolution): {
  width: number;
  height: number;
  aspectRatio: string;
  label: string;
}
```

#### Native Bridge Updates (`src/utils/native-bridge.ts`)
- Added `startMlvRecording()` method
- Added `stopMlvRecording()` method
- Updated `startRecording()` to handle resolution enum

#### UI Updates
- **CameraScreen**: Updated mode selector to show MLV option
- **SettingsScreen**: Added three open-gate resolution options
- Added capture mode selector (RAW / MLV / LOG VIDEO)

### Backend Changes

#### MLV Writer (`android/app/src/main/java/com/xraw/camera/format/MlvWriter.kt`)
Complete MLV format implementation:
- File header with MLVI block
- RAW info block (RAWI) with sensor dimensions and bit depth
- Exposure block (EXPO) with shutter speed and ISO
- White balance block (WBAL)
- Real-time clock block (RTC)
- Identity block (IDNT) with camera name and model
- Video frame blocks (VIDF) with timestamps
- Index block (INDX) for frame lookup

Key features:
- Little-endian byte order (MLV standard)
- 64-byte block alignment
- CRC32 checksums for data integrity
- Frame indexing for recovery

#### Camera Plugin Updates (`android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt`)
- Added `startMlvRecording()` method
- Added `startMlvWriterProcessing()` for background frame processing
- Updated `stopRecordingInternal()` to handle MLV finalization
- Integrated MLV writer with existing frame queue system

## Performance Optimizations

### Memory Management
- Bounded frame queue prevents OOM errors
- Byte array pooling for frame data
- Immediate Image buffer copying to prevent blocking
- Efficient garbage collection with minimal allocations

### Storage Performance
- Sequential writes optimize UFS 2.1 performance
- Buffered output reduces system call overhead
- 64-byte alignment matches flash page sizes
- Periodic checkpoints enable fast recovery

### CPU Efficiency
- Dedicated writer thread separates I/O from capture
- Minimal work in camera callbacks
- Efficient frame processing pipeline
- No unnecessary data copies

## Device-Specific Optimizations

### Redmi Note 12 Pro 5G
- **Chipset**: MediaTek Dimensity 1080
- **Sensor**: Sony IMX766 (50MP)
- **Storage**: UFS 2.1
- **Target**: 24 FPS sustained recording

Optimizations:
- Open-gate modes preserve full sensor coverage
- 4:3 aspect ratio matches sensor native aspect
- 16-bit RAW depth for maximum quality
- Thermal monitoring to prevent throttling

## File Format Comparison

| Format | Extension | Compression | Use Case |
|--------|-----------|-------------|----------|
| XRAW | .xraw | None | Maximum compatibility |
| XRAWLC | .xrawlc | Lossless | Reduced file size |
| MLV | .mlv | None | MLV App compatibility |
| LOG VIDEO | .mp4 | H.264/HEVC | Processed video |

## Build Status

✅ **Frontend**: TypeScript compilation successful  
✅ **Vite Build**: Production build successful (194KB JS + 27KB CSS)  
✅ **Native Code**: Kotlin implementation complete  
✅ **MLV Format**: Full writer implementation  
✅ **UI**: Updated with new modes and resolutions  

## Testing Requirements

### Device Testing Needed
1. **1080p Open Gate Recording**
   - Verify 24 FPS sustained performance
   - Check for dropped frames
   - Monitor thermal behavior
   - Validate MLV file playback in MLV App

2. **2K Open Gate Recording**
   - Test sustained recording stability
   - Monitor storage throughput
   - Check for frame drops

3. **4K Open Gate Recording**
   - Experimental mode testing
   - Likely to have performance limitations
   - Monitor thermal throttling

4. **MLV File Validation**
   - Open in MLV App
   - Verify metadata accuracy
   - Check frame integrity
   - Test recovery from interrupted recordings

## Known Limitations

### Hardware Constraints
- 4K open-gate may not sustain 24 FPS due to sensor bandwidth
- UFS 2.1 write speed may bottleneck at higher resolutions
- Thermal throttling may reduce sustained performance
- MediaTek ISP may have limitations vs Snapdragon

### Software Constraints
- MLV format is primarily designed for Canon cameras
- Some MLV App features may not work with Android RAW data
- Color science may differ from Canon implementations
- Black level and white level may need calibration

## Future Enhancements

### Potential Improvements
1. **Adaptive Resolution**: Automatically switch to lower resolution if frame drops detected
2. **Dual ISO Support**: Capture both high and low ISO simultaneously
3. **Focus Peaking**: Real-time focus assistance overlay
4. **Histogram**: Live exposure monitoring
5. **Waveform Monitor**: Professional exposure analysis
6. **Audio Recording**: Synchronized audio capture
7. **Timecode**: SMPTE timecode support
8. **Proxy Files**: Generate low-res proxies for editing

### Performance Optimizations
1. **Zero-Copy Pipeline**: Direct DMA buffer access
2. **Hardware Compression**: Use ISP for lossless compression
3. **Async I/O**: Overlap capture and write operations
4. **Memory Mapping**: Direct file mapping for writes

## Installation & Usage

### Building the APK
```bash
# Frontend
npm install
npm run build

# Android
cd android
./gradlew assembleDebug
```

### Installing on Device
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Using MLV Mode
1. Open XRAW Camera app
2. Go to Settings
3. Select "MLV" under Capture Mode
4. Choose resolution (1080p/2K/4K Open Gate)
5. Set frame rate to 24 FPS
6. Start recording
7. Transfer .mlv files to computer
8. Open in MLV App for processing

## Technical Specifications

### MLV File Structure
```
[MLVI Block - 256 bytes]
[RAWI Block - 128 bytes]
[EXPO Block - 64 bytes]
[WBAL Block - 64 bytes]
[RTC Block - 64 bytes]
[IDNT Block - 128 bytes]
[VIDF Frame 0 - variable]
[VIDF Frame 1 - variable]
...
[INDX Block - variable]
```

### Frame Data Format
- **Bit Depth**: 16-bit (RAW_SENSOR)
- **Color Filter**: RGGB Bayer pattern
- **Packing**: Unpacked (2 bytes per pixel)
- **Byte Order**: Little-endian (MLV standard)

### Metadata Fields
- Camera name: "XRAW Camera"
- Camera model: "Redmi Note 12 Pro 5G"
- Timestamp: Unix epoch milliseconds
- Exposure time: Nanoseconds
- ISO: Sensor sensitivity
- White balance: Kelvin temperature

## Conclusion

This implementation provides a complete MLV recording solution optimized for the Redmi Note 12 Pro 5G, with three open-gate resolution modes and a professional-grade recording pipeline. The MLV format ensures compatibility with MLV App and other professional RAW video tools.

**Next Steps**: Test on actual device to validate performance and MLV App compatibility.
