# XRAW File Format Specification
## Version 1.0

### Overview

XRAW is a custom file format for storing RAW sensor data from digital cameras. It consists of two variants:

- **`.xraw`** — Uncompressed RAW container
- **`.xrawlc`** — Lossless compressed RAW (XRAWLC codec)

Both formats share the same container structure. The only difference is the compression method applied to frame data.

### Design Goals

1. **Lossless preservation** of original sensor samples
2. **Recovery** from interrupted recordings
3. **Self-documenting** headers with full metadata
4. **Cross-platform** compatibility (Windows, macOS, Linux)
5. **Versioned** for future extensibility
6. **Integrity verified** with CRC32 checksums

### Endianness

All multi-byte integers are **big-endian** (network byte order).

### File Structure

```
┌──────────────────────────────┐
│     File Header (64 bytes)   │
├──────────────────────────────┤
│     Frame Record 0           │
│     [16-byte header + data]  │
├──────────────────────────────┤
│     Frame Record 1           │
│     [16-byte header + data]  │
├──────────────────────────────┤
│     ...                      │
├──────────────────────────────┤
│     Index Checkpoint         │
│     (at recovery intervals)  │
├──────────────────────────────┤
│     ...                      │
├──────────────────────────────┤
│     Final Index              │
└──────────────────────────────┘
```

### File Header (64 bytes)

| Offset | Size (bytes) | Field | Type | Description |
|--------|-------------|-------|------|-------------|
| 0 | 4 | magic | uint32 | Always 0x58524157 ("XRAW" in ASCII) |
| 4 | 2 | version | uint16 | Format version (currently 1) |
| 6 | 2 | headerSize | uint16 | Total header size in bytes (64) |
| 8 | 4 | imageWidth | uint32 | Frame width in pixels |
| 12 | 4 | imageHeight | uint32 | Frame height in pixels |
| 16 | 1 | sampleFormat | uint8 | 0 = RAW Bayer, 1 = RAW Mono |
| 17 | 1 | bitDepth | uint8 | Bits per sample (10, 12, 14, or 16) |
| 18 | 1 | packingLayout | uint8 | 0 = unpacked (16-bit aligned), 1 = MIPI packed |
| 19 | 1 | cfaPattern | uint8 | 0=RGGB, 1=BGGR, 2=GRBG, 3=GBRG |
| 20 | 1 | compressionId | uint8 | 0 = none (raw), 1 = XRAWLC lossless |
| 21 | 1 | reserved1 | uint8 | Reserved, must be 0 |
| 22 | 4 | frameCount | uint32 | Total frames (0 = streaming/unknown) |
| 26 | 4 | frameRate | uint32 | Nominal frame rate × 1000 (e.g., 24000 for 24fps) |
| 30 | 8 | timestamp | uint64 | Capture start time, nanoseconds since Unix epoch |
| 38 | 4 | exposureTime | uint32 | Exposure time in nanoseconds |
| 42 | 4 | iso | uint32 | Sensor sensitivity (ISO value) |
| 46 | 4 | whiteBalance | uint32 | Color temperature in Kelvin |
| 50 | 4 | focusDistance | uint32 | Focus distance in diopters × 1000 |
| 54 | 1 | checksumAlgorithm | uint8 | 0 = CRC32, 1 = SHA-256 |
| 55 | 1 | recoveryInterval | uint8 | Frames between index checkpoints |
| 56 | 2 | reserved2 | uint16 | Reserved, must be 0 |
| 60 | 4 | headerChecksum | uint32 | CRC32 of bytes 0–59 |

**Total header size: 64 bytes**

### Frame Record

Each frame record consists of a 16-byte header followed by frame data:

| Offset | Size (bytes) | Field | Type | Description |
|--------|-------------|-------|------|-------------|
| 0 | 4 | frameMagic | uint32 | Always 0x46524D43 ("FRMC") |
| 4 | 4 | frameIndex | uint32 | Sequential frame number (0-based) |
| 8 | 4 | dataSize | uint32 | Size of frame data in bytes |
| 12 | 4 | checksum | uint32 | CRC32 of frame data |
| 16 | dataSize | data | bytes | Raw or compressed pixel data |

**Frame data size calculation (uncompressed):**
- For 16-bit unpacked: `imageWidth × imageHeight × 2`
- For 12-bit MIPI packed: `imageWidth × imageHeight × 1.5` (rounded up)
- For 10-bit MIPI packed: `imageWidth × imageHeight × 1.25` (rounded up)

### Index Checkpoint

Index checkpoints are written at regular intervals (defined by `recoveryInterval` in the header) and once at the end of the file. They enable partial file recovery.

| Offset | Size (bytes) | Field | Type | Description |
|--------|-------------|-------|------|-------------|
| 0 | 4 | indexMagic | uint32 | Always 0x494E4458 ("INDX") |
| 4 | 4 | entryCount | uint32 | Number of entries in this index |
| 8 | 12 × entryCount | entries | — | Array of index entries |

**Index Entry (12 bytes each):**

| Offset | Size (bytes) | Field | Type | Description |
|--------|-------------|-------|------|-------------|
| 0 | 4 | frameIndex | uint32 | Frame number |
| 4 | 8 | fileOffset | uint64 | Byte offset from start of file |

### XRAWLC Lossless Codec

The XRAWLC codec compresses RAW sensor data without any loss. Decoding reproduces every original sample exactly.

#### Algorithm

1. **Prediction**: For each pixel, compute a predicted value using the JPEG-LOCO median edge predictor:
   - `h = left_neighbor`
   - `v = above_neighbor`  
   - `d = diagonal_neighbor (upper-left)`
   - If `h > b`: `pred = d + (h - v)`
   - Else: `pred = d - (v - h)`

2. **Residual**: `residual = actual - predicted`

3. **Packing**: Residuals are stored as signed 16-bit integers in big-endian order.

4. **Header**: The compressed block begins with:
   - 2 bytes: width
   - 2 bytes: height
   - 1 byte: bit depth
   - Followed by `width × height × 2` bytes of residuals

#### Guarantees

- **Exact reconstruction**: Every original sample is recovered without modification
- **No clipping**: Residuals are bounded to `[-maxVal, maxVal]`
- **Deterministic**: Same input always produces same output

### Recovery

The format supports recovery from interrupted recordings:

1. **Index checkpoints** allow finding the last complete frame
2. **Frame magic bytes** (0x46524D43) enable scanning for valid frames
3. **CRC32 checksums** detect corrupted frames
4. **Header frame count** is updated at finalization

**Recovery procedure:**
1. Read and validate file header
2. Scan for frame records by looking for 0x46524D43
3. Verify each frame's CRC32
4. Use the last valid index checkpoint to skip to known-good data
5. Continue scanning from the checkpoint

### Versioning

- The `version` field allows future format changes
- Version 1 readers should reject files with version > 1
- New fields must be added to reserved areas first
- Breaking changes increment the major version

### Compatibility Notes

- This format is **not** compatible with Adobe DNG, Canon CR2/CR3, Nikon NEF, or Sony ARW
- A dedicated decoder (XRAW Studio) is required to process these files
- The format prioritizes simplicity and recovery over universal compatibility
- Bayer pattern data must be demosaiced before display

### Example: Reading a File

```python
import struct

def read_xraw_header(filepath):
    with open(filepath, 'rb') as f:
        data = f.read(64)
    
    magic = struct.unpack('>I', data[0:4])[0]
    assert magic == 0x58524157, "Invalid XRAW magic"
    
    version = struct.unpack('>H', data[4:6])[0]
    width = struct.unpack('>I', data[8:12])[0]
    height = struct.unpack('>I', data[12:16])[0]
    bit_depth = data[17]
    compression = data[20]
    frame_count = struct.unpack('>I', data[22:26])[0]
    
    return {
        'version': version,
        'width': width,
        'height': height,
        'bit_depth': bit_depth,
        'compression': compression,
        'frame_count': frame_count,
    }
```
