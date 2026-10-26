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
                compressionId = 1,
                frameCount = 0,
                frameRate = 24000,
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
                sampleFormat = 0, compressionId = 0,
                frameCount = 2, frameRate = 0,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            
            // Write test frames
            val frame0 = ByteArray(32) { it.toByte() }
            val frame1 = ByteArray(32) { (it + 32).toByte() }
            
            writer.writeFrame(frame0, 0)
            writer.writeFrame(frame1, 1)
            writer.finalize()
            
            // Verify file structure
            val data = tempFile.readBytes()
            assertTrue("File should contain header + 2 frames", data.size > 64)
            
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
        
        // Generate test data
        val original = ShortArray(width * height) { (it * 137 % 4096).toShort() }
        
        // Compress
        val compressed = codec.compress(original)
        
        // Decompress
        val decompressed = codec.decompress(compressed)
        
        // Verify exact match
        assertArrayEquals("Lossless round-trip should preserve all samples", original, decompressed)
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
    fun testHeaderChecksumValidation() {
        val tempFile = File.createTempFile("xraw_test", ".xraw")
        try {
            val writer = XRawWriter(tempFile)
            writer.writeHeader(
                width = 100, height = 100, bitDepth = 16,
                sampleFormat = 0, compressionId = 0,
                frameCount = 0, frameRate = 0,
                exposureTime = 0, iso = 0, whiteBalance = 0, focusDistance = 0
            )
            writer.finalize()
            
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
}
