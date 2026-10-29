// XRAW File Format Implementation (TypeScript Reference)
// Binary format specification for .xraw and .xrawlc files
// Must match the Kotlin implementation in XRawWriter.kt

export const XRAW_MAGIC = 0x58524157; // "XRAW" in ASCII
export const XRAW_VERSION = 1;

// Compression identifiers
export const COMPRESSION_NONE = 0;
export const COMPRESSION_XRAWLC_LOSSLESS = 1;

// Sample formats
export const SAMPLE_RAW_BAYER = 0;
export const SAMPLE_RAW_MONO = 1;

// CFA Patterns
export const CFA_RGGB = 0;
export const CFA_BGGR = 1;
export const CFA_GRBG = 2;
export const CFA_GBRG = 3;

// Checksum algorithms
export const CHECKSUM_CRC32 = 0;
export const CHECKSUM_SHA256 = 1;

export interface XRAWFileHeader {
  magic: number;           // 4 bytes - 0x58524157
  version: number;         // 2 bytes - format version
  headerSize: number;      // 2 bytes - total header size in bytes
  imageWidth: number;      // 4 bytes - frame width in pixels
  imageHeight: number;     // 4 bytes - frame height in pixels
  sampleFormat: number;    // 1 byte - 0=Bayer, 1=Mono
  bitDepth: number;        // 1 byte - bits per sample (10, 12, 14, 16)
  packingLayout: number;   // 1 byte - 0=unpacked, 1=MIPI packed
  cfaPattern: number;      // 1 byte - CFA pattern identifier
  compressionId: number;   // 1 byte - compression method
  reserved1: number;       // 1 byte
  frameCount: number;      // 4 bytes - total frames (0 if streaming)
  frameRate: number;       // 4 bytes - frames per second * 1000
  timestamp: bigint;       // 8 bytes - nanoseconds since Unix epoch
  exposureTime: number;    // 4 bytes - exposure time in nanoseconds
  iso: number;             // 4 bytes - sensor sensitivity
  whiteBalance: number;    // 4 bytes - color temperature in Kelvin
  focusDistance: number;   // 4 bytes - focus distance in diopters * 1000
  checksumAlgorithm: number; // 1 byte - checksum method
  recoveryInterval: number;  // 1 byte - frames between index checkpoints
  reserved2: number;       // 2 bytes
  headerChecksum: number;  // 4 bytes - CRC32 of header (excluding this field)
}

// Header is 64 bytes total
export const HEADER_SIZE = 64;

// Frame record structure:
// [4 bytes: frame magic 0x46524D43 "FRMC"]
// [4 bytes: frame index]
// [4 bytes: frame data size]
// [4 bytes: frame checksum]
// [N bytes: frame data]

export const FRAME_MAGIC = 0x46524D43; // "FRMC"
export const FRAME_HEADER_SIZE = 16;

// Index record (written at recovery intervals):
// [4 bytes: index magic 0x494E4458 "INDX"]
// [4 bytes: number of entries]
// [N * 12 bytes: entries (frame_index:4, offset:8)]

export const INDEX_MAGIC = 0x494E4458; // "INDX"

/**
 * CRC32 implementation for checksums
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();
  
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: Uint32Array | null = null;

function getCRC32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
    crc32Table[i] = crc;
  }
  return crc32Table;
}

/**
 * Encode XRAW file header to binary
 */
export function encodeHeader(header: XRAWFileHeader): Uint8Array {
  const buffer = new ArrayBuffer(HEADER_SIZE);
  const view = new DataView(buffer);
  
  view.setUint32(0, header.magic, false);        // Big-endian
  view.setUint16(4, header.version, false);
  view.setUint16(6, header.headerSize, false);
  view.setUint32(8, header.imageWidth, false);
  view.setUint32(12, header.imageHeight, false);
  view.setUint8(16, header.sampleFormat);
  view.setUint8(17, header.bitDepth);
  view.setUint8(18, header.packingLayout);
  view.setUint8(19, header.cfaPattern);
  view.setUint8(20, header.compressionId);
  view.setUint8(21, header.reserved1);
  view.setUint32(22, header.frameCount, false);
  view.setUint32(26, header.frameRate, false);
  // timestamp as two 32-bit values (big-endian) — nanoseconds since Unix epoch
  view.setUint32(30, Number((header.timestamp >> BigInt(32)) & BigInt(0xFFFFFFFF)), false);
  view.setUint32(34, Number(header.timestamp & BigInt(0xFFFFFFFF)), false);
  view.setUint32(38, header.exposureTime, false);
  view.setUint32(42, header.iso, false);
  view.setUint32(46, header.whiteBalance, false);
  view.setUint32(50, header.focusDistance, false);
  view.setUint8(54, header.checksumAlgorithm);
  view.setUint8(55, header.recoveryInterval);
  view.setUint16(56, header.reserved2, false);
  
  // Calculate header checksum (bytes 0-59)
  const headerData = new Uint8Array(buffer, 0, 60);
  const checksum = crc32(headerData);
  view.setUint32(60, checksum, false);
  
  return new Uint8Array(buffer);
}

/**
 * Decode XRAW file header from binary
 */
export function decodeHeader(data: Uint8Array): XRAWFileHeader | null {
  if (data.length < HEADER_SIZE) return null;
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  
  const magic = view.getUint32(0, false);
  if (magic !== XRAW_MAGIC) return null;
  
  const header: XRAWFileHeader = {
    magic,
    version: view.getUint16(4, false),
    headerSize: view.getUint16(6, false),
    imageWidth: view.getUint32(8, false),
    imageHeight: view.getUint32(12, false),
    sampleFormat: view.getUint8(16),
    bitDepth: view.getUint8(17),
    packingLayout: view.getUint8(18),
    cfaPattern: view.getUint8(19),
    compressionId: view.getUint8(20),
    reserved1: view.getUint8(21),
    frameCount: view.getUint32(22, false),
    frameRate: view.getUint32(26, false),
    timestamp: (BigInt(view.getUint32(30, false)) << BigInt(32)) | BigInt(view.getUint32(34, false)),
    exposureTime: view.getUint32(38, false),
    iso: view.getUint32(42, false),
    whiteBalance: view.getUint32(46, false),
    focusDistance: view.getUint32(50, false),
    checksumAlgorithm: view.getUint8(54),
    recoveryInterval: view.getUint8(55),
    reserved2: view.getUint16(56, false),
    headerChecksum: view.getUint32(60, false),
  };
  
  // Verify header checksum
  const headerData = new Uint8Array(data.buffer, data.byteOffset, 60);
  const computedChecksum = crc32(headerData);
  if (computedChecksum !== header.headerChecksum) {
    console.warn('XRAW header checksum mismatch');
  }
  
  return header;
}

/**
 * XRAWLC Lossless Compression (TypeScript Reference Implementation)
 * 
 * Uses adaptive median-edge prediction (JPEG-LOCO) + Int residuals.
 * This matches the Kotlin implementation exactly.
 * 
 * IMPORTANT: Uses Int32 for residuals (not Int16) to handle 16-bit samples
 * where residuals can exceed Short range.
 */
export class XRAWLCEncoder {
  private width: number;
  private height: number;
  private bitDepth: number;
  
  constructor(width: number, height: number, bitDepth: number) {
    if (width <= 0 || height <= 0) throw new Error(`Invalid dimensions: ${width}x${height}`);
    if (bitDepth < 8 || bitDepth > 16) throw new Error(`Unsupported bit depth: ${bitDepth}`);
    
    this.width = width;
    this.height = height;
    this.bitDepth = bitDepth;
  }
  
  /**
   * Compress RAW image data losslessly
   * Input: Uint16Array of pixel values (unsigned)
   * Output: Compressed Uint8Array
   */
  compress(input: Uint16Array): Uint8Array {
    if (input.length !== this.width * this.height) {
      throw new Error(`Input size ${input.length} doesn't match dimensions ${this.width}x${this.height}`);
    }
    
    const maxVal = (1 << this.bitDepth) - 1;
    // Use Int32 for residuals to handle 16-bit data without overflow
    const residuals = new Int32Array(this.width * this.height);
    
    // Compute residuals using adaptive median-edge prediction
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const current = input[idx];
        
        const hPred = x > 0 ? input[idx - 1] : 0;
        const vPred = y > 0 ? input[(y - 1) * this.width + x] : 0;
        const dPred = (x > 0 && y > 0) ? input[(y - 1) * this.width + (x - 1)] : 0;
        
        let pred: number;
        if (x === 0 && y === 0) {
          pred = 0;
        } else if (x === 0) {
          pred = vPred;
        } else if (y === 0) {
          pred = hPred;
        } else {
          pred = this.medianPredict(hPred, vPred, dPred);
        }
        
        // No clamping — preserve exact residual
        residuals[idx] = current - pred;
      }
    }
    
    // Pack residuals as Int32
    return this.packResiduals(residuals);
  }
  
  /**
   * Decompress XRAWLC data back to original samples
   */
  decompress(compressed: Uint8Array): Uint16Array {
    if (compressed.length < 5) throw new Error('Compressed data too short');
    
    const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    
    const w = view.getUint16(0, false);
    const h = view.getUint16(2, false);
    const bd = compressed[4];
    
    if (w !== this.width || h !== this.height) {
      throw new Error(`Compressed dimensions ${w}x${h} don't match codec ${this.width}x${this.height}`);
    }
    if (bd !== this.bitDepth) {
      throw new Error(`Compressed bit depth ${bd} doesn't match codec ${this.bitDepth}`);
    }
    
    const output = new Uint16Array(w * h);
    
    // Validate we have enough data for all residuals (4 bytes each)
    const expectedSize = 5 + (w * h * 4);
    if (compressed.length < expectedSize) {
      throw new Error(`Compressed data truncated: expected ${expectedSize} bytes, got ${compressed.length}`);
    }

    // Unpack residuals as Int32
    let offset = 5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        
        const residual = view.getInt32(offset, false);
        offset += 4;
        
        const hPred = x > 0 ? output[idx - 1] : 0;
        const vPred = y > 0 ? output[(y - 1) * w + x] : 0;
        const dPred = (x > 0 && y > 0) ? output[(y - 1) * w + (x - 1)] : 0;
        
        let pred: number;
        if (x === 0 && y === 0) {
          pred = 0;
        } else if (x === 0) {
          pred = vPred;
        } else if (y === 0) {
          pred = hPred;
        } else {
          pred = this.medianPredict(hPred, vPred, dPred);
        }
        
        // Exact reconstruction - no masking
        output[idx] = pred + residual;
      }
    }
    
    return output;
  }
  
  private medianPredict(a: number, b: number, c: number): number {
    // Standard JPEG-LOCO median edge prediction: median(a, b, a+b-c)
    const max = Math.max(a, b);
    const min = Math.min(a, b);
    if (c >= max) return min;
    if (c <= min) return max;
    return a + b - c;
  }
  
  private packResiduals(residuals: Int32Array): Uint8Array {
    // Header: width(2) + height(2) + bitDepth(1) = 5 bytes
    // Each residual: 4 bytes (Int32) to handle full range -65535 to +65535
    // Note: This is not compressed yet - entropy coding will be added later
    const output = new Uint8Array(5 + residuals.length * 4);
    const view = new DataView(output.buffer);
    
    view.setUint16(0, this.width, false);
    view.setUint16(2, this.height, false);
    output[4] = this.bitDepth;
    
    let offset = 5;
    for (let i = 0; i < residuals.length; i++) {
      view.setInt32(offset, residuals[i], false);
      offset += 4;
    }
    
    return output;
  }
}

/**
 * Verify lossless round-trip for test data
 */
export function verifyRoundTrip(width: number, height: number, bitDepth: number): boolean {
  const encoder = new XRAWLCEncoder(width, height, bitDepth);
  const maxVal = (1 << bitDepth) - 1;
  
  // Generate test data with fixed seed
  const original = new Uint16Array(width * height);
  let seed = 42;
  for (let i = 0; i < original.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
    original[i] = seed % (maxVal + 1);
  }
  
  // Compress
  const compressed = encoder.compress(original);
  
  // Decompress
  const decompressed = encoder.decompress(compressed);
  
  // Verify exact match
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== decompressed[i]) {
      return false;
    }
  }
  
  return true;
}
