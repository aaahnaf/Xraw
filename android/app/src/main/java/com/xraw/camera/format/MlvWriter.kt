package com.xraw.camera.format

import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/**
 * MLV (Magic Lantern Video) File Writer
 * 
 * Implements the MLV format compatible with MLV App and other MLV tools.
 * MLV is a container format for RAW video from Canon cameras, adapted for Android.
 * 
 * File Structure:
 * [MLV Header Block]
 * [Video Block]
 * [Audio Block - optional]
 * [RAWI Block - RAW info]
 * [EXPO Block - exposure info]
 * [WBAL Block - white balance]
 * [LENS Block - lens info]
 * [RTC Block - real-time clock]
 * [IDNT Block - identity]
 * [Frame 0]
 * [Frame 1]
 * ...
 * [INDX Block - index]
 * 
 * All blocks are aligned to 64-byte boundaries.
 */
class MlvWriter(private val file: File) {
    
    companion object {
        const val MLV_VERSION = 2.0
        
        // Block types as ASCII strings (4 bytes each)
        const val BLOCK_MLVI = "MLVI" // Main header
        const val BLOCK_RAWI = "RAWI" // RAW info
        const val BLOCK_EXPO = "EXPO" // Exposure
        const val BLOCK_WBAL = "WBAL" // White balance
        const val BLOCK_LENS = "LENS" // Lens
        const val BLOCK_RTC = "RTC " // Real-time clock (with space)
        const val BLOCK_IDNT = "IDNT" // Identity
        const val BLOCK_VIDF = "VIDF" // Video frame
        const val BLOCK_INDX = "INDX" // Index
        
        const val BLOCK_ALIGNMENT = 64
        
        // Helper to write block tag as ASCII
        fun writeBlockTag(buffer: ByteBuffer, tag: String) {
            val bytes = tag.toByteArray(Charsets.US_ASCII)
            require(bytes.size == 4) { "Block tag must be exactly 4 bytes: $tag" }
            buffer.put(bytes)
        }
    }
    
    @Volatile private var outputStream: FileOutputStream? = null
    private var currentOffset: Long = 0
    private var totalFrames: Int = 0
    private var isFinalized: Boolean = false
    
    // Frame index for recovery
    private val frameIndex = mutableListOf<FrameEntry>()
    
    // Metadata
    var currentFileSize: Long = 0
        private set
    var imageWidth: Int = 0
        private set
    var imageHeight: Int = 0
        private set
    var bitDepth: Int = 0
        private set
    var filePath: String = file.absolutePath
        private set
    
    data class FrameEntry(val frameIndex: Int, val fileOffset: Long, val timestamp: Long)
    
    /**
     * Write MLV file header and metadata blocks
     */
    @Synchronized
    fun writeHeader(
        width: Int,
        height: Int,
        bitDepth: Int,
        frameRate: Double,
        timestampMillis: Long,
        exposureTime: Long,
        iso: Int,
        whiteBalance: Int,
        cameraName: String = "XRAW Camera",
        cameraModel: String = "Android"
    ) {
        if (outputStream != null) {
            throw IllegalStateException("Writer already initialized")
        }
        
        this.imageWidth = width
        this.imageHeight = height
        this.bitDepth = bitDepth
        
        try {
            outputStream = FileOutputStream(file)
            
            // Write MLVI block (main header)
            writeMlviBlock(frameRate, timestampMillis, cameraName, cameraModel)
            
            // Write RAWI block (RAW info)
            writeRawiBlock(width, height, bitDepth)
            
            // Write EXPO block (exposure)
            writeExpoBlock(exposureTime, iso)
            
            // Write WBAL block (white balance)
            writeWbalBlock(whiteBalance)
            
            // Write RTC block (real-time clock)
            writeRtcBlock(timestampMillis)
            
            // Write IDNT block (identity)
            writeIdntBlock(cameraName, cameraModel)
            
            currentOffset = outputStream!!.channel.position()
            currentFileSize = currentOffset
            
        } catch (e: Exception) {
            close()
            throw e
        }
    }
    
    private fun writeMlviBlock(frameRate: Double, timestampMillis: Long, cameraName: String, cameraModel: String) {
        val buffer = ByteBuffer.allocate(256)
        buffer.order(ByteOrder.LITTLE_ENDIAN) // MLV uses little-endian
        
        // Block header
        writeBlockTag(buffer, BLOCK_MLVI)
        val blockSizePos = buffer.position()
        buffer.putInt(0) // Placeholder for block size
        buffer.putLong(timestampMillis * 1000) // Timestamp in microseconds
        
        // File GUID (16 bytes)
        val guid = ByteArray(16)
        System.arraycopy(java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16).toByteArray(), 0, guid, 0, 16)
        buffer.put(guid)
        
        // File count
        buffer.putInt(1)
        
        // File index
        buffer.putInt(0)
        
        // Frame count (placeholder, updated on finalize)
        buffer.putInt(0)
        
        // Frame rate
        buffer.putLong((frameRate * 1000000).toLong()) // microseconds per frame
        
        // Reserved
        buffer.put(ByteArray(32))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        // Align to 64 bytes
        alignToBlock()
    }
    
    private fun writeRawiBlock(width: Int, height: Int, bitDepth: Int) {
        val buffer = ByteBuffer.allocate(128)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_RAWI)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // Raw info
        buffer.putShort(width.toShort())
        buffer.putShort(height.toShort())
        buffer.putInt(bitDepth)
        
        // Compression (0 = none, 1 = lossless)
        buffer.putInt(0)
        
        // Origin (0, 0)
        buffer.putShort(0)
        buffer.putShort(0)
        
        // Active area (full sensor)
        buffer.putShort(width.toShort())
        buffer.putShort(height.toShort())
        
        // Black level
        buffer.putInt(2048)
        
        // White level
        buffer.putInt((1 shl bitDepth) - 1)
        
        // CFA pattern (RGGB = 0x94)
        buffer.putInt(0x94)
        
        // Calibration illuminant 1 (D65 = 21)
        buffer.putInt(21)
        
        // Reserved
        buffer.put(ByteArray(32))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    private fun writeExpoBlock(exposureTime: Long, iso: Int) {
        val buffer = ByteBuffer.allocate(64)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_EXPO)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // Exposure time in microseconds
        buffer.putLong(exposureTime / 1000)
        
        // ISO analog
        buffer.putInt(iso)
        
        // ISO digital
        buffer.putInt(iso)
        
        // Reserved
        buffer.put(ByteArray(32))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    private fun writeWbalBlock(whiteBalance: Int) {
        val buffer = ByteBuffer.allocate(64)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_WBAL)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // White balance mode (0 = custom)
        buffer.putInt(0)
        
        // Kelvin
        buffer.putInt(whiteBalance)
        
        // RGB multipliers (neutral = 1.0)
        buffer.putFloat(1.0f)
        buffer.putFloat(1.0f)
        buffer.putFloat(1.0f)
        
        // Reserved
        buffer.put(ByteArray(32))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    private fun writeRtcBlock(timestampMillis: Long) {
        val buffer = ByteBuffer.allocate(64)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_RTC)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // Timestamp
        buffer.putLong(timestampMillis)
        
        // Reserved
        buffer.put(ByteArray(40))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    private fun writeIdntBlock(cameraName: String, cameraModel: String) {
        val buffer = ByteBuffer.allocate(128)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_IDNT)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // Camera name (32 bytes)
        val nameBytes = cameraName.toByteArray()
        buffer.put(nameBytes, 0, minOf(nameBytes.size, 32))
        buffer.put(ByteArray(32 - minOf(nameBytes.size, 32)))
        
        // Camera model (32 bytes)
        val modelBytes = cameraModel.toByteArray()
        buffer.put(modelBytes, 0, minOf(modelBytes.size, 32))
        buffer.put(ByteArray(32 - minOf(modelBytes.size, 32)))
        
        // Reserved
        buffer.put(ByteArray(32))
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        outputStream!!.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    /**
     * Write a single video frame
     */
    @Synchronized
    fun writeFrame(data: ByteArray, frameIndex: Int, timestampMicros: Long) {
        val os = outputStream ?: throw IllegalStateException("Writer not initialized")
        if (isFinalized) throw IllegalStateException("Writer already finalized")
        
        try {
            val buffer = ByteBuffer.allocate(64)
            buffer.order(ByteOrder.LITTLE_ENDIAN)
            
            // Block header
            writeBlockTag(buffer, BLOCK_VIDF)
            val blockSizePos = buffer.position()
            buffer.putInt(0)
            
            // Frame timestamp in microseconds
            buffer.putLong(timestampMicros)
            
            // Frame number
            buffer.putInt(frameIndex)
            
            // Reserved
            buffer.put(ByteArray(40))
            
            // Write block header
            val headerSize = buffer.position()
            buffer.putInt(blockSizePos, headerSize + data.size)
            buffer.flip()
            os.write(buffer.array(), 0, headerSize)
            
            // Write frame data
            os.write(data)
            
            // Record frame index
            this.frameIndex.add(FrameEntry(frameIndex, currentOffset, timestampMicros))
            
            currentOffset += headerSize + data.size
            currentFileSize = currentOffset
            totalFrames++
            
            // Align to 64 bytes
            alignToBlock()
            
        } catch (e: Exception) {
            throw e
        }
    }
    
    /**
     * Finalize the MLV file
     */
    @Synchronized
    fun finalizeFile() {
        if (isFinalized) return
        isFinalized = true
        
        val os = outputStream ?: return
        
        try {
            // Write index block
            writeIndxBlock()
            
            // Update frame count in MLVI block
            os.flush()
            os.close()
            outputStream = null
            
            // Open as RandomAccessFile to update frame count
            val raf = RandomAccessFile(file, "rw")
            try {
                // Frame count is at offset 40 in MLVI block
                // Layout: [4: magic][4: size][8: timestamp][16: GUID][4: fileCount][4: fileIndex][4: frameCount]
                // Offset:  0        4         8           16          32           36          40
                raf.seek(40)
                val frameCountBuffer = ByteBuffer.allocate(4)
                frameCountBuffer.order(ByteOrder.LITTLE_ENDIAN)
                frameCountBuffer.putInt(totalFrames)
                raf.write(frameCountBuffer.array())
            } finally {
                raf.close()
            }
            
        } catch (e: Exception) {
            try { outputStream?.close() } catch (e2: Exception) {}
            outputStream = null
            throw e
        }
    }
    
    private fun writeIndxBlock() {
        val os = outputStream ?: return
        
        // Calculate actual size: 4 (magic) + 4 (size) + 4 (count) + entries * 20 bytes each
        // Each entry: 4 (frameIndex) + 8 (fileOffset) + 8 (timestamp) = 20 bytes
        val bufferSize = 12 + frameIndex.size * 20
        val buffer = ByteBuffer.allocate(bufferSize)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // Block header
        writeBlockTag(buffer, BLOCK_INDX)
        val blockSizePos = buffer.position()
        buffer.putInt(0)
        
        // Entry count
        buffer.putInt(frameIndex.size)
        
        // Entries
        for (entry in frameIndex) {
            buffer.putInt(entry.frameIndex)
            buffer.putLong(entry.fileOffset)
            buffer.putLong(entry.timestamp)
        }
        
        // Write block
        val blockSize = buffer.position()
        buffer.putInt(blockSizePos, blockSize)
        buffer.flip()
        os.write(buffer.array(), 0, blockSize)
        
        // Update offset tracking
        currentOffset += blockSize
        currentFileSize = currentOffset
        
        alignToBlock()
    }
    
    private fun alignToBlock() {
        val os = outputStream ?: return
        val remainder = currentOffset % BLOCK_ALIGNMENT
        if (remainder != 0L) {
            val padding = ByteArray((BLOCK_ALIGNMENT - remainder).toInt())
            os.write(padding)
            currentOffset += padding.size
            currentFileSize = currentOffset
        }
    }
    
    /**
     * Close the writer without finalizing
     */
    @Synchronized
    fun close() {
        try {
            outputStream?.close()
        } catch (e: Exception) {}
        outputStream = null
    }
}
