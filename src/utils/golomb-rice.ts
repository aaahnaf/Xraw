/**
 * Golomb-Rice entropy coder for XRAWLC lossless compression.
 * 
 * Implements adaptive Golomb-Rice coding optimized for the Laplacian-like
 * distribution of median-edge prediction residuals in RAW sensor data.
 * 
 * Format:
 * - Header: 5 bytes (width:2, height:2, bitDepth:1)
 * - k parameter: 1 byte (Golomb-Rice parameter, 0-15)
 * - Encoded residuals: variable length
 * 
 * Each residual is encoded as:
 * - Quotient q = abs(residual) >> k (unary coded as q zeros followed by a 1)
 * - Remainder r = abs(residual) & ((1 << k) - 1) (k bits)
 * - Sign bit: 0 for positive, 1 for negative (1 bit)
 * 
 * Reference: Wikipedia "Golomb coding", JPEG-LS standard
 */

const MAX_K = 15;
const MIN_K = 0;

/**
 * Estimate optimal k parameter for a set of residuals.
 * Uses the Laplacian distribution assumption.
 */
function estimateK(residuals: Int32Array): number {
  if (residuals.length === 0) return 0;
  
  // Calculate mean absolute value
  let sum = 0;
  for (let i = 0; i < residuals.length; i++) {
    sum += Math.abs(residuals[i]);
  }
  const mean = sum / residuals.length;
  
  // Optimal k for Laplacian distribution: k = log2(mean)
  // Clamp to valid range
  const k = mean <= 0 ? 0 : Math.floor(Math.log2(mean));
  return Math.max(MIN_K, Math.min(MAX_K, k));
}

/**
 * Encode residuals using Golomb-Rice coding.
 * Returns compressed Uint8Array.
 */
export function encode(residuals: Int32Array, bitDepth: number): Uint8Array {
  const k = estimateK(residuals);
  
  // Estimate output size (conservative)
  // Worst case: each residual takes k + 1 + 32 bits
  const maxBits = residuals.length * (k + 1 + 32);
  const maxBytes = Math.ceil(maxBits / 8) + 10;  // +10 for header
  
  const output = new Uint8Array(maxBytes);
  let outputPos = 0;
  
  // Write k parameter
  output[outputPos++] = k;
  
  // Bit writer state
  let currentByte = 0;
  let bitsInCurrentByte = 0;
  
  function writeBit(bit: number): void {
    currentByte = (currentByte << 1) | (bit & 1);
    bitsInCurrentByte++;
    if (bitsInCurrentByte === 8) {
      output[outputPos++] = currentByte;
      currentByte = 0;
      bitsInCurrentByte = 0;
    }
  }
  
  // Encode each residual
  for (let i = 0; i < residuals.length; i++) {
    const r = residuals[i];
    const absR = Math.abs(r);
    const q = absR >>> k;  // quotient
    const rem = absR & ((1 << k) - 1);  // remainder
    const sign = r < 0 ? 1 : 0;
    
    // Write quotient in unary (q zeros followed by 1)
    for (let j = 0; j < q; j++) {
      writeBit(0);
    }
    writeBit(1);
    
    // Write remainder (k bits)
    if (k > 0) {
      for (let j = k - 1; j >= 0; j--) {
        writeBit((rem >>> j) & 1);
      }
    }
    
    // Write sign bit
    writeBit(sign);
  }
  
  // Flush remaining bits
  if (bitsInCurrentByte > 0) {
    currentByte = currentByte << (8 - bitsInCurrentByte);
    output[outputPos++] = currentByte;
  }
  
  // Return compressed data (trim to actual size)
  return output.slice(0, outputPos);
}

/**
 * Decode Golomb-Rice encoded residuals.
 * Returns decoded Int32Array.
 */
export function decode(encoded: Uint8Array, k: number, count: number): Int32Array {
  const output = new Int32Array(count);
  let inputPos = 0;
  
  // Bit reader state
  let currentByte = 0;
  let bitsRemaining = 0;
  
  function readBit(): number {
    if (bitsRemaining === 0) {
      if (inputPos >= encoded.length) return 0;  // EOF
      currentByte = encoded[inputPos++];
      bitsRemaining = 8;
    }
    bitsRemaining--;
    return (currentByte >>> bitsRemaining) & 1;
  }
  
  // Decode each residual
  for (let i = 0; i < count; i++) {
    // Read quotient (unary: count zeros until 1)
    let q = 0;
    while (readBit() === 0) {
      q++;
    }
    
    // Read remainder (k bits)
    let rem = 0;
    for (let j = 0; j < k; j++) {
      rem = (rem << 1) | readBit();
    }
    
    // Read sign bit
    const sign = readBit();
    
    // Reconstruct value
    const absR = (q << k) | rem;
    output[i] = sign === 1 ? -absR : absR;
  }
  
  return output;
}
