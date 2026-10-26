package com.xraw.camera.format

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/**
 * Unit tests for XRAW file format
 */
class XRawFormatTest {

    @Test
    fun testHeaderEncoding() {
        val tempFile = File.createTempFile("xraw_test", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 1920,
                height = 1080,
                bitDepth = 12,
                sampleFormat = 0,
                cfaPattern = 0,
                compressionId = 1,
                frameCount = 0,
                frameRate = 24000,
                timestampNanos = 1700000000000000000L, // Fixed epoch nanos
                exposureTime = 41666666L,
                iso = 400,
                whiteBalance = 5500,
                focusDistance = 1000
            )
            
            // Read back and verify
            val data = tempFile.readBytes()
            assertTrue("File should have header", data.size >= 64)
            
            val buffer = ByteBuffer.wrap(data)
            buffer.order(ByteOrder.BIG_ENDIAN)
            
            // Verify magic
            val magic = buffer.getInt(0)
            assertEquals("Magic should be XRAW", 0x58524157, magic)
            
            // Verify version
            val version = buffer.getShort(4)
            assertEquals("Version should be 1", 1, version.toShort())
            
            // Verify dimensions
            val width = buffer.getInt(8)
            val height = buffer.getInt(12)
            assertEquals("Width should be 1920", 1920, width)
            assertEquals("Height should be 1080", 1080, height)
            
            // Verify bit depth
            val bitDepth = data[17].toInt()
            assertEquals("Bit depth should be 12", 12, bitDepth)
            
            // Verify compression
            val compression = data[20].toInt()
            assertEquals("Compression should be XRAWLC", 1, compression)
            
            // Verify timestamp (epoch nanos, not System.nanoTime())
            val tsHigh = buffer.getInt(30).toLong() and 0xFFFFFFFFL
            val tsLow = buffer.getInt(34).toLong() and 0xFFFFFFFFL
            val timestamp = (tsHigh shl 32) or tsLow
            assertEquals("Timestamp should be epoch nanos", 1700000000000000000L, timestamp)
            
        } finally {
            tempFile.delete()
        }
    }
    
    @Test
    fun testFrameWriteAndRead() {
        val tempFile = File.createTempFile("xraw_test", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 4, height = 4, bitDepth = 16,
                sampleFormat = 0, cfaPattern = 0, compressionId = 0,
                frameCount = 2, frameRate = 0,
                timestampNanos = System.currentTimeMillis() * 1_000_000L,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            
            // Write test frames
            val frame0 = ByteArray(32) { it.toByte() }
            val frame1 = ByteArray(32) { (it + 32).toByte() }
            
            writer.writeFrame(frame0, 0)
            writer.writeFrame(frame1, 1)
            writer.finalizeFile()
            
            // Verify file structure
            val data = tempFile.readBytes()
            assertTrue("File should contain header + 2 frames + index", data.size > 64)
            
            // Check first frame header
            val frameOffset = 64
            val buffer = ByteBuffer.wrap(data, frameOffset, 16)
            buffer.order(ByteOrder.BIG_ENDIAN)
            
            val frameMagic = buffer.getInt()
            assertEquals("Frame magic should be FRMC", 0x46524D43, frameMagic)
            
            val frameIdx = buffer.getInt()
            assertEquals("First frame index should be 0", 0, frameIdx)
            
            val frameSize = buffer.getInt()
            assertEquals("Frame size should be 32", 32, frameSize)
            
        } finally {
            tempFile.delete()
        }
    }
    
    @Test
    fun testCRC32Integrity() {
        val data = byteArrayOf(0x48, 0x65, 0x6C, 0x6C, 0x6F) // "Hello"
        val crc = CRC32()
        crc.update(data)
        val checksum = crc.value
        
        // Verify CRC is consistent
        val crc2 = CRC32()
        crc2.update(data)
        assertEquals("CRC32 should be deterministic", checksum, crc2.value)
    }
    
    @Test
    fun testXRAWLCLosslessRoundTrip() {
        val width = 8
        val height = 8
        val bitDepth = 12
        
        val codec = XRawLCCodec(width, height, bitDepth)
        
        // Generate test data with fixed seed
        val original = ShortArray(width * height)
        var seed = 42L
        for (i in original.indices) {
            seed = (seed * 1103515245L + 12345L) and 0x7FFFFFFFL
            original[i] = (seed % 4096).toShort()
        }
        
        // Compress
        val compressed = codec.compress(original)
        
        // Decompress
        val decompressed = codec.decompress(compressed)
        
        // Verify exact match
        assertArrayEquals("Lossless round-trip should preserve all samples", original, decompressed)
    }
    
    @Test
    fun testXRAWLC16BitRoundTrip() {
        // Test with 16-bit samples — residuals can exceed Short range
        val width = 4
        val height = 4
        val bitDepth = 16
        
        val codec = XRawLCCodec(width, height, bitDepth)
        
        // Generate data with values that produce large residuals
        val original = ShortArray(width * height)
        for (i in original.indices) {
            original[i] = (i * 4369).toShort() // Pattern that creates large residuals
        }
        
        val compressed = codec.compress(original)
        val decompressed = codec.decompress(compressed)
        
        assertArrayEquals("16-bit round-trip should preserve all samples", original, decompressed)
    }
    
    @Test
    fun testXRAWLCEdgeCases() {
        val width = 4
        val height = 4
        val bitDepth = 10
        
        val codec = XRawLCCodec(width, height, bitDepth)
        
        // Test with all zeros
        val zeros = ShortArray(width * height) { 0 }
        val compressedZeros = codec.compress(zeros)
        val decompressedZeros = codec.decompress(compressedZeros)
        assertArrayEquals("All zeros should round-trip", zeros, decompressedZeros)
        
        // Test with max values
        val maxVal = ((1 shl bitDepth) - 1).toShort()
        val maxValues = ShortArray(width * height) { maxVal }
        val compressedMax = codec.compress(maxValues)
        val decompressedMax = codec.decompress(compressedMax)
        assertArrayEquals("Max values should round-trip", maxValues, decompressedMax)
        
        // Test with alternating values
        val alternating = ShortArray(width * height) { if (it % 2 == 0) 0.toShort() else maxVal }
        val compressedAlt = codec.compress(alternating)
        val decompressedAlt = codec.decompress(compressedAlt)
        assertArrayEquals("Alternating values should round-trip", alternating, decompressedAlt)
    }
    
    @Test
    fun testXRAWLCBoundaryDimensions() {
        // Test 1x1
        val codec1 = XRawLCCodec(1, 1, 12)
        val data1 = shortArrayOf(1234)
        val comp1 = codec1.compress(data1)
        val decomp1 = codec1.decompress(comp1)
        assertArrayEquals("1x1 should round-trip", data1, decomp1)
        
        // Test 2x2
        val codec2 = XRawLCCodec(2, 2, 12)
        val data2 = shortArrayOf(100, 200, 300, 400)
        val comp2 = codec2.compress(data2)
        val decomp2 = codec2.decompress(comp2)
        assertArrayEquals("2x2 should round-trip", data2, decomp2)
    }
    
    @Test
    fun testXRAWLCAllBitDepths() {
        for (bitDepth in listOf(8, 10, 12, 14, 16)) {
            val width = 4
            val height = 4
            val codec = XRawLCCodec(width, height, bitDepth)
            val maxVal = ((1 shl bitDepth) - 1).toShort()
            
            val original = ShortArray(width * height) { i ->
                ((i * 137 + 42) % (maxVal + 1)).toShort()
            }
            
            val compressed = codec.compress(original)
            val decompressed = codec.decompress(compressed)
            
            assertArrayEquals("Round-trip for bitDepth=$bitDepth should be exact", original, decompressed)
        }
    }
    
    @Test(expected = IllegalArgumentException::class)
    fun testXRAWLCInvalidDimensions() {
        XRawLCCodec(0, 4, 12)
    }
    
    @Test(expected = IllegalArgumentException::class)
    fun testXRAWLCInvalidBitDepth() {
        XRawLCCodec(4, 4, 7)
    }
    
    @Test
    fun testHeaderChecksumValidation() {
        val tempFile = File.createTempFile("xraw_test", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 100, height = 100, bitDepth = 16,
                sampleFormat = 0, cfaPattern = 0, compressionId = 0,
                frameCount = 0, frameRate = 0,
                timestampNanos = 1000000000000L,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            writer.finalizeFile()
            
            val data = tempFile.readBytes()
            
            // Read stored checksum
            val buffer = ByteBuffer.wrap(data, 60, 4)
            buffer.order(ByteOrder.BIG_ENDIAN)
            val storedChecksum = buffer.getInt()
            
            // Compute checksum of header bytes 0-59
            val headerBytes = data.copyOfRange(0, 60)
            val crc = CRC32()
            crc.update(headerBytes)
            val computedChecksum = crc.value.toInt()
            
            assertEquals("Header checksum should match", storedChecksum, computedChecksum)
            
        } finally {
            tempFile.delete()
        }
    }
    
    @Test
    fun testFileValidation() {
        val tempFile = File.createTempFile("xraw_validate", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 8, height = 8, bitDepth = 16,
                sampleFormat = 0, cfaPattern = 0, compressionId = 0,
                frameCount = 3, frameRate = 0,
                timestampNanos = System.currentTimeMillis() * 1_000_000L,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            
            // Write 3 frames
            for (i in 0 until 3) {
                val frame = ByteArray(8 * 8 * 2) { (it + i).toByte() }
                writer.writeFrame(frame, i)
            }
            
            writer.finalizeFile()
            
            // Validate
            val reader = XRawReader(tempFile)
            val result = reader.validate()
            
            assertTrue("File should be valid", result.valid)
            assertTrue("Header should be valid", result.headerValid)
            assertEquals("Should have 3 valid frames", 3, result.validFrames)
            assertEquals("Should have 0 corrupted frames", 0, result.corruptedFrames)
            assertEquals("Width should be 8", 8, result.width)
            assertEquals("Height should be 8", 8, result.height)
            assertEquals("Bit depth should be 16", 16, result.bitDepth)
            
        } finally {
            tempFile.delete()
        }
    }
    
    @Test
    fun testTruncatedFileValidation() {
        val tempFile = File.createTempFile("xraw_truncated", ".xraw")
        try {
            // Write a valid file
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 4, height = 4, bitDepth = 16,
                sampleFormat = 0, cfaPattern = 0, compressionId = 0,
                frameCount = 2, frameRate = 0,
                timestampNanos = 1000000L,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            writer.writeFrame(ByteArray(32), 0)
            writer.writeFrame(ByteArray(32), 1)
            writer.finalizeFile()
            
            // Truncate the file
            val data = tempFile.readBytes()
            tempFile.writeBytes(data.copyOf(data.size / 2))
            
            // Validate — should detect corruption
            val reader = XRawReader(tempFile)
            val result = reader.validate()
            
            // The file is truncated, so it may have fewer valid frames
            assertTrue("Should have fewer valid frames than expected", result.validFrames < 2)
            
        } finally {
            tempFile.delete()
        }
    }
    
    @Test
    fun testWriterCannotWriteAfterFinalize() {
        val tempFile = File.createTempFile("xraw_finalized", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 4, height = 4, bitDepth = 16,
                sampleFormat = 0, cfaPattern = 0, compressionId = 0,
                frameCount = 0, frameRate = 0,
                timestampNanos = 1000L,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            writer.finalizeFile()
            
            // Attempting to write after finalize should throw
            try {
                writer.writeFrame(ByteArray(32), 0)
                fail("Should throw IllegalStateException")
            } catch (e: IllegalStateException) {
                // Expected
            }
        } finally {
            tempFile.delete()
        }
    }
}
