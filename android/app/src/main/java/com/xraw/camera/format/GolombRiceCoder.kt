package com.xraw.camera.format

import java.nio.ByteBuffer
import java.nio.ByteOrder

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
class GolombRiceCoder {
    
    companion object {
        const val MAX_K = 15
        const val MIN_K = 0
    }
    
    /**
     * Estimate optimal k parameter for a set of residuals.
     * Uses the Laplacian distribution assumption.
     */
    fun estimateK(residuals: IntArray): Int {
        if (residuals.isEmpty()) return 0
        
        // Calculate mean absolute value
        var sum = 0L
        for (r in residuals) {
            sum += Math.abs(r)
        }
        val mean = sum / residuals.size
        
        // Optimal k for Laplacian distribution: k = log2(mean)
        // Clamp to valid range
        val k = if (mean <= 0) 0 else (Math.log(mean.toDouble()) / Math.log(2.0)).toInt()
        return k.coerceIn(MIN_K, MAX_K)
    }
    
    /**
     * Encode residuals using Golomb-Rice coding.
     * Returns compressed byte array.
     */
    fun encode(residuals: IntArray, bitDepth: Int): ByteArray {
        val k = estimateK(residuals)
        
        // Estimate output size (conservative)
        // Worst case: each residual takes k + 1 + 32 bits
        val maxBits = residuals.size * (k + 1 + 32)
        val maxBytes = (maxBits + 7) / 8 + 10  // +10 for header
        
        val output = ByteBuffer.allocate(maxBytes)
        output.order(ByteOrder.BIG_ENDIAN)
        
        // Write header
        // Note: width and height are written by caller, we just write k
        output.put(k.toByte())
        
        // Bit writer state
        var currentByte = 0
        var bitsInCurrentByte = 0
        
        // Encode each residual
        for (r in residuals) {
            val absR = Math.abs(r)
            val q = absR shr k  // quotient
            val rem = absR and ((1 shl k) - 1)  // remainder
            val sign = if (r < 0) 1 else 0
            
            // Write quotient in unary (q zeros followed by 1)
            for (i in 0 until q) {
                currentByte = (currentByte shl 1) or 0
                bitsInCurrentByte++
                if (bitsInCurrentByte == 8) {
                    output.put(currentByte.toByte())
                    currentByte = 0
                    bitsInCurrentByte = 0
                }
            }
            // Write the 1 that terminates the quotient
            currentByte = (currentByte shl 1) or 1
            bitsInCurrentByte++
            if (bitsInCurrentByte == 8) {
                output.put(currentByte.toByte())
                currentByte = 0
                bitsInCurrentByte = 0
            }
            
            // Write remainder (k bits)
            if (k > 0) {
                for (i in k - 1 downTo 0) {
                    val bit = (rem shr i) and 1
                    currentByte = (currentByte shl 1) or bit
                    bitsInCurrentByte++
                    if (bitsInCurrentByte == 8) {
                        output.put(currentByte.toByte())
                        currentByte = 0
                        bitsInCurrentByte = 0
                    }
                }
            }
            
            // Write sign bit
            currentByte = (currentByte shl 1) or sign
            bitsInCurrentByte++
            if (bitsInCurrentByte == 8) {
                output.put(currentByte.toByte())
                currentByte = 0
                bitsInCurrentByte = 0
            }
        }
        
        // Flush remaining bits
        if (bitsInCurrentByte > 0) {
            currentByte = currentByte shl (8 - bitsInCurrentByte)
            output.put(currentByte.toByte())
        }
        
        // Return compressed data
        output.flip()
        val result = ByteArray(output.remaining())
        output.get(result)
        return result
    }
    
    /**
     * Decode Golomb-Rice encoded residuals.
     * Returns decoded IntArray.
     */
    fun decode(encoded: ByteArray, k: Int, count: Int): IntArray {
        val output = IntArray(count)
        val input = ByteBuffer.wrap(encoded)
        input.order(ByteOrder.BIG_ENDIAN)
        
        // Bit reader state
        var currentByte = 0
        var bitsRemaining = 0
        
        fun readBit(): Int {
            if (bitsRemaining == 0) {
                if (!input.hasRemaining()) return 0  // EOF
                currentByte = input.get().toInt() and 0xFF
                bitsRemaining = 8
            }
            bitsRemaining--
            return (currentByte shr bitsRemaining) and 1
        }
        
        // Decode each residual
        for (i in 0 until count) {
            // Read quotient (unary: count zeros until 1)
            var q = 0
            while (readBit() == 0) {
                q++
            }
            
            // Read remainder (k bits)
            var rem = 0
            for (j in 0 until k) {
                rem = (rem shl 1) or readBit()
            }
            
            // Read sign bit
            val sign = readBit()
            
            // Reconstruct value
            val absR = (q shl k) or rem
            output[i] = if (sign == 1) -absR else absR
        }
        
        return output
    }
}
