package com.xraw.camera.format

import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/**
 * XRAW File Writer
 *
 * Writes .xraw and .xrawlc files with proper header, frame records,
 * index checkpoints, and CRC32 integrity verification.
 *
 * File Layout:
 * [64-byte header]
 * [Frame 0: 16-byte frame header + data]
 * [Frame 1: 16-byte frame header + data]
 * ...
 * [Index checkpoint at recovery intervals]
 * ...
 * [Final index + finalized header]
 */
class XRawWriter(private val file: File) {

    companion object {
        const val XRAW_MAGIC = 0x58524157 // "XRAW"
        const val XRAW_VERSION = 1
        const val HEADER_SIZE = 64
        const val FRAME_MAGIC = 0x46524D43 // "FRMC"
        const val FRAME_HEADER_SIZE = 16
        const val INDEX_MAGIC = 0x494E4458 // "INDX"

        // Compression IDs
        const val COMPRESSION_NONE = 0
        const val COMPRESSION_XRAWLC = 1
    }

    @Volatile private var outputStream: FileOutputStream? = null
    private var currentOffset: Long = HEADER_SIZE.toLong()
    private var totalFrames: Int = 0
    private var isFinalized: Boolean = false

    // Index entries for recovery — capped to prevent unbounded growth
    private val indexEntries = mutableListOf<IndexEntry>()
    private val MAX_INDEX_ENTRIES = 10000

    // Expose metadata for plugin access
    var currentFileSize: Long = HEADER_SIZE.toLong()
        private set
    var compressionId: Int = 0
        private set
    var imageWidth: Int = 0
        private set
    var imageHeight: Int = 0
        private set
    var bitDepth: Int = 0
        private set
    var filePath: String = file.absolutePath
        private set

    data class IndexEntry(val frameIndex: Int, val fileOffset: Long)

    /**
     * Write the XRAW file header.
     *
     * @param timestampNanos Nanoseconds since Unix epoch (NOT System.nanoTime())
     */
    @Synchronized
    fun writeHeader(
        width: Int,
        height: Int,
        bitDepth: Int,
        sampleFormat: Int,
        cfaPattern: Int,
        compressionId: Int,
        frameCount: Int,
        frameRate: Int,
        timestampNanos: Long,
        exposureTime: Long,
        iso: Int,
        whiteBalance: Int,
        focusDistance: Int,
        rowStride: Int = 0,
        pixelStride: Int = 0
    ) {
        if (outputStream != null) {
            throw IllegalStateException("Writer already initialized")
        }

        this.imageWidth = width
        this.imageHeight = height
        this.bitDepth = bitDepth
        this.compressionId = compressionId

        val buffer = ByteBuffer.allocate(HEADER_SIZE)
        buffer.order(ByteOrder.BIG_ENDIAN)

        // Magic (4 bytes)
        buffer.putInt(XRAW_MAGIC)
        // Version (2 bytes)
        buffer.putShort(XRAW_VERSION.toShort())
        // Header size (2 bytes)
        buffer.putShort(HEADER_SIZE.toShort())
        // Image dimensions (4+4 bytes)
        buffer.putInt(width)
        buffer.putInt(height)
        // Sample format (1 byte)
        buffer.put(sampleFormat.toByte())
        // Bit depth (1 byte)
        buffer.put(bitDepth.toByte())
        // Packing layout (1 byte) — 0=unpacked, 1=MIPI
        buffer.put(if (pixelStride == 1 && bitDepth < 16) 1 else 0)
        // CFA pattern (1 byte)
        buffer.put(cfaPattern.toByte())
        // Compression ID (1 byte)
        buffer.put(compressionId.toByte())
        // Reserved (1 byte)
        buffer.put(0)
        // Frame count (4 bytes) — 0 for streaming
        buffer.putInt(frameCount)
        // Frame rate (4 bytes) — fps * 1000
        buffer.putInt(frameRate)
        // Timestamp (8 bytes) — nanoseconds since Unix epoch
        // FIX: Use the provided epoch nanos, not System.nanoTime()
        buffer.putInt((timestampNanos ushr 32).toInt())
        buffer.putInt((timestampNanos and 0xFFFFFFFFL).toInt())
        // Exposure time (4 bytes)
        buffer.putInt(exposureTime.toInt())
        // ISO (4 bytes)
        buffer.putInt(iso)
        // White balance (4 bytes)
        buffer.putInt(whiteBalance)
        // Focus distance (4 bytes) — diopters * 1000
        buffer.putInt(focusDistance)
        // Checksum algorithm (1 byte) — 0=CRC32
        buffer.put(0)
        // Recovery interval (1 byte)
        buffer.put(48)
        // Reserved (4 bytes)
        buffer.putInt(0)

        // Calculate header CRC32 (bytes 0-59)
        val headerBytes = ByteArray(60)
        buffer.flip()
        buffer.get(headerBytes)

        val crc = CRC32()
        crc.update(headerBytes)

        // Reset and write complete header with checksum
        buffer.clear()
        buffer.put(headerBytes)
        buffer.putInt(crc.value.toInt())

        // Write to file
        try {
            outputStream = FileOutputStream(file)
            outputStream!!.write(buffer.array())
            outputStream!!.flush()
            currentOffset = HEADER_SIZE.toLong()
            currentFileSize = HEADER_SIZE.toLong()
        } catch (e: Exception) {
            close()
            throw e
        }
    }

    /**
     * Write a single frame record.
     * Thread-safe: synchronized to prevent concurrent writes.
     */
    @Synchronized
    fun writeFrame(data: ByteArray, frameIndex: Int) {
        val os = outputStream ?: throw IllegalStateException("Writer not initialized")
        if (isFinalized) throw IllegalStateException("Writer already finalized")

        try {
            val buffer = ByteBuffer.allocate(FRAME_HEADER_SIZE)
            buffer.order(ByteOrder.BIG_ENDIAN)

            // Frame magic
            buffer.putInt(FRAME_MAGIC)
            // Frame index
            buffer.putInt(frameIndex)
            // Frame data size
            buffer.putInt(data.size)
            // Frame checksum (CRC32 of data)
            val crc = CRC32()
            crc.update(data)
            buffer.putInt(crc.value.toInt())

            // Write frame header
            os.write(buffer.array())
            // Write frame data
            os.write(data)
            os.flush()

            val frameOffset = currentOffset
            currentOffset += FRAME_HEADER_SIZE + data.size
            currentFileSize = currentOffset
            totalFrames++

            // Track index entry (capped)
            if (indexEntries.size < MAX_INDEX_ENTRIES) {
                indexEntries.add(IndexEntry(frameIndex, frameOffset))
            }
        } catch (e: Exception) {
            // Don't finalize on write error — let caller decide
            throw e
        }
    }

    /**
     * Write an index checkpoint for recovery.
     * After writing, clears the index entries list to prevent unbounded growth.
     */
    @Synchronized
    fun writeIndex() {
        val os = outputStream ?: return
        if (isFinalized) return
        if (indexEntries.isEmpty()) return

        try {
            val buffer = ByteBuffer.allocate(8 + indexEntries.size * 12)
            buffer.order(ByteOrder.BIG_ENDIAN)

            // Index magic
            buffer.putInt(INDEX_MAGIC)
            // Number of entries
            buffer.putInt(indexEntries.size)

            // Write entries
            for (entry in indexEntries) {
                buffer.putInt(entry.frameIndex)
                buffer.putLong(entry.fileOffset)
            }

            os.write(buffer.array())
            os.flush()
            currentOffset += buffer.array().size
            currentFileSize = currentOffset

            // Clear entries after writing checkpoint (keep list bounded)
            indexEntries.clear()
        } catch (e: Exception) {
            // Index write failure is non-fatal — frames are still intact
        }
    }

    /**
     * Finalize the file — update frame count and recalculate header CRC.
     * Renamed from finalize() to avoid shadowing Object.finalize().
     */
    @Synchronized
    fun finalizeFile() {
        if (isFinalized) return

        val os = outputStream ?: return

        try {
            // Write final index BEFORE setting isFinalized flag
            writeIndex()

            // Now mark as finalized
            isFinalized = true

            // Flush and close the output stream
            os.flush()
            os.close()
            outputStream = null

            // Open as RandomAccessFile to update header
            val raf = RandomAccessFile(file, "rw")
            try {
                // Update frame count at offset 22 (4 bytes)
                raf.seek(22)
                val frameCountBuffer = ByteBuffer.allocate(4)
                frameCountBuffer.order(ByteOrder.BIG_ENDIAN)
                frameCountBuffer.putInt(totalFrames)
                raf.write(frameCountBuffer.array())

                // Recalculate header CRC
                val headerBytes = ByteArray(60)
                raf.seek(0)
                raf.readFully(headerBytes)

                val crc = CRC32()
                crc.update(headerBytes)

                raf.seek(60)
                val crcBuffer = ByteBuffer.allocate(4)
                crcBuffer.order(ByteOrder.BIG_ENDIAN)
                crcBuffer.putInt(crc.value.toInt())
                raf.write(crcBuffer.array())
            } finally {
                raf.close()
            }
        } catch (e: Exception) {
            // Try to close output stream if still open
            try { outputStream?.close() } catch (e2: Exception) {}
            outputStream = null
            throw e
        }
    }

    /**
     * Close the writer without finalizing.
     * Used for error cleanup.
     */
    @Synchronized
    fun close() {
        try {
            outputStream?.close()
        } catch (e: Exception) {}
        outputStream = null
    }
}

/**
 * XRAWLC Lossless Codec
 *
 * Uses adaptive median-edge prediction (JPEG-LOCO) + 16-bit residual packing.
 * Guarantees exact reconstruction of all original samples.
 *
 * IMPORTANT: This codec operates on ShortArray (16-bit signed) samples.
 * For bit depths ≤ 12, samples are stored in the lower bits of each Short.
 * Residuals are stored as Short values.
 *
 * For 16-bit samples, residuals can range from -(2^16-1) to +(2^16-1),
 * which exceeds Short range. We handle this by using IntArray internally
 * and packing as pairs of bytes.
 */
class XRawLCCodec(private val width: Int, private val height: Int, private val bitDepth: Int) {

    init {
        require(width > 0 && height > 0) { "Invalid dimensions: ${width}x${height}" }
        require(bitDepth in 8..16) { "Unsupported bit depth: $bitDepth" }
    }

    /**
     * Compress RAW image data losslessly.
     * Input: ShortArray of pixel values (unsigned values stored in lower bits)
     * Output: Compressed ByteArray
     */
    fun compress(input: ShortArray): ByteArray {
        require(input.size == width * height) {
            "Input size ${input.size} doesn't match dimensions ${width}x${height}"
        }

        val maxVal = (1 shl bitDepth) - 1
        // Use IntArray for residuals to avoid Short overflow for 16-bit data
        val residuals = IntArray(width * height)

        // Compute residuals using adaptive median-edge prediction
        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val current = input[idx].toInt() and 0xFFFF // Treat as unsigned

                val hPred = if (x > 0) input[idx - 1].toInt() and 0xFFFF else 0
                val vPred = if (y > 0) input[(y - 1) * width + x].toInt() and 0xFFFF else 0
                val dPred = if (x > 0 && y > 0) input[(y - 1) * width + (x - 1)].toInt() and 0xFFFF else 0

                val pred = when {
                    x == 0 && y == 0 -> 0
                    x == 0 -> vPred
                    y == 0 -> hPred
                    else -> medianPredict(hPred, vPred, dPred)
                }

                // Residual without clamping — must preserve exact values
                residuals[idx] = current - pred
            }
        }

        // Pack residuals
        return packResiduals(residuals)
    }

    /**
     * Decompress XRAWLC data back to original samples.
     * Returns ShortArray with unsigned values in lower bits.
     */
    fun decompress(compressed: ByteArray): ShortArray {
        require(compressed.size >= 5) { "Compressed data too short" }

        val buffer = ByteBuffer.wrap(compressed)
        buffer.order(ByteOrder.BIG_ENDIAN)

        val w = buffer.short.toInt() and 0xFFFF
        val h = buffer.short.toInt() and 0xFFFF
        val bd = buffer.get().toInt() and 0xFF

        // Validate dimensions match
        require(w == width && h == height) {
            "Compressed dimensions ${w}x${h} don't match codec ${width}x${height}"
        }
        require(bd == bitDepth) {
            "Compressed bit depth $bd doesn't match codec $bitDepth"
        }

        // Validate we have enough data for all residuals
        val expectedSize = 5 + (w * h * 4)
        require(compressed.size >= expectedSize) {
            "Compressed data truncated: expected $expectedSize bytes, got ${compressed.size}"
        }

        // Unpack residuals
        val residuals = IntArray(w * h)
        for (i in residuals.indices) {
            residuals[i] = buffer.int
        }

        // Reconstruct from residuals
        val output = ShortArray(w * h)

        for (y in 0 until h) {
            for (x in 0 until w) {
                val idx = y * w + x
                val residual = residuals[idx]

                val hPred = if (x > 0) output[idx - 1].toInt() and 0xFFFF else 0
                val vPred = if (y > 0) output[(y - 1) * w + x].toInt() and 0xFFFF else 0
                val dPred = if (x > 0 && y > 0) output[(y - 1) * w + (x - 1)].toInt() and 0xFFFF else 0

                val pred = when {
                    x == 0 && y == 0 -> 0
                    x == 0 -> vPred
                    y == 0 -> hPred
                    else -> medianPredict(hPred, vPred, dPred)
                }

                // Exact reconstruction - no masking, no clamping
                // pred + residual must equal original value exactly
                val value = pred + residual
                output[idx] = value.toShort()
            }
        }

        return output
    }

    private fun medianPredict(a: Int, b: Int, c: Int): Int {
        // JPEG-LOCO median edge prediction
        return if (a > b) {
            c + (a - b)
        } else {
            c - (b - a)
        }
    }

    private fun packResiduals(residuals: IntArray): ByteArray {
        // Header: width(2) + height(2) + bitDepth(1) = 5 bytes
        // Each residual: 4 bytes (Int) — no clamping, no overflow
        val output = ByteBuffer.allocate(5 + residuals.size * 4)
        output.order(ByteOrder.BIG_ENDIAN)

        // Header
        output.putShort(width.toShort())
        output.putShort(height.toShort())
        output.put(bitDepth.toByte())

        // Residuals as 32-bit signed integers
        for (r in residuals) {
            output.putInt(r)
        }

        return output.array()
    }
}

/**
 * XRAW File Reader / Validator
 *
 * Reads and validates XRAW files for integrity checking.
 * Used by the app for file inspection — not a desktop editor.
 */
class XRawReader(private val file: File) {

    data class ValidationResult(
        val valid: Boolean,
        val headerValid: Boolean,
        val frameCount: Int,
        val validFrames: Int,
        val corruptedFrames: Int,
        val width: Int,
        val height: Int,
        val bitDepth: Int,
        val compressionId: Int,
        val errors: List<String>
    )

    /**
     * Validate file integrity without loading all frame data.
     */
    fun validate(): ValidationResult {
        val errors = mutableListOf<String>()

        if (!file.exists()) {
            return ValidationResult(false, false, 0, 0, 0, 0, 0, 0, 0, listOf("File not found"))
        }

        if (file.length() < XRawWriter.HEADER_SIZE) {
            return ValidationResult(false, false, 0, 0, 0, 0, 0, 0, 0, listOf("File too small for header"))
        }

        val raf = RandomAccessFile(file, "r")
        try {
            // Read header
            val headerBytes = ByteArray(XRawWriter.HEADER_SIZE)
            try {
                raf.readFully(headerBytes)
            } catch (e: java.io.EOFException) {
                return ValidationResult(false, false, 0, 0, 0, 0, 0, 0, 0, listOf("File truncated during header read"))
            }

            val buffer = ByteBuffer.wrap(headerBytes)
            buffer.order(ByteOrder.BIG_ENDIAN)

            // Verify magic
            val magic = buffer.int
            if (magic != XRawWriter.XRAW_MAGIC) {
                errors.add("Invalid magic: 0x${magic.toString(16)}")
                return ValidationResult(false, false, 0, 0, 0, 0, 0, 0, 0, errors)
            }

            // Verify header CRC
            val storedCrc = buffer.getInt(60)
            val crc = CRC32()
            crc.update(headerBytes, 0, 60)
            val computedCrc = crc.value.toInt()
            val headerValid = storedCrc == computedCrc
            if (!headerValid) {
                errors.add("Header CRC mismatch")
            }

            // Read dimensions
            val width = buffer.getInt(8)
            val height = buffer.getInt(12)
            val bitDepth = headerBytes[17].toInt() and 0xFF
            val compressionId = headerBytes[20].toInt() and 0xFF
            val frameCount = buffer.getInt(22)

            // Scan frames
            var offset = XRawWriter.HEADER_SIZE.toLong()
            var validFrames = 0
            var corruptedFrames = 0
            val fileLength = file.length()

            while (offset < fileLength) {
                raf.seek(offset)

                // Check if we hit an index
                val peekBytes = ByteArray(4)
                if (raf.read(peekBytes) < 4) break

                val peekBuffer = ByteBuffer.wrap(peekBytes)
                peekBuffer.order(ByteOrder.BIG_ENDIAN)
                val peekMagic = peekBuffer.int

                if (peekMagic == XRawWriter.INDEX_MAGIC) {
                    // Skip index block
                    raf.seek(offset + 4)
                    val entryCountBytes = ByteArray(4)
                    try {
                        raf.readFully(entryCountBytes)
                    } catch (e: java.io.EOFException) {
                        errors.add("File truncated during index read")
                        break
                    }
                    val entryCount = ByteBuffer.wrap(entryCountBytes).order(ByteOrder.BIG_ENDIAN).int
                    offset += 8 + entryCount.toLong() * 12
                    continue
                }

                if (peekMagic != XRawWriter.FRAME_MAGIC) {
                    errors.add("Unexpected data at offset $offset")
                    break
                }

                // Read frame header
                raf.seek(offset)
                val frameHeaderBytes = ByteArray(XRawWriter.FRAME_HEADER_SIZE)
                try {
                    raf.readFully(frameHeaderBytes)
                } catch (e: java.io.EOFException) {
                    errors.add("File truncated during frame header read at offset $offset")
                    break
                }

                val fhBuffer = ByteBuffer.wrap(frameHeaderBytes)
                fhBuffer.order(ByteOrder.BIG_ENDIAN)
                fhBuffer.int // magic
                val frameIndex = fhBuffer.int
                val dataSize = fhBuffer.int
                val storedFrameCrc = fhBuffer.int

                // Validate data size
                if (dataSize <= 0 || dataSize > 100_000_000) {
                    errors.add("Invalid frame data size at index $frameIndex: $dataSize")
                    break
                }

                // Read frame data and verify CRC
                val frameData = ByteArray(dataSize)
                try {
                    raf.readFully(frameData)
                } catch (e: java.io.EOFException) {
                    errors.add("File truncated during frame data read at index $frameIndex")
                    break
                }

                val frameCrc = CRC32()
                frameCrc.update(frameData)
                if (frameCrc.value.toInt() == storedFrameCrc) {
                    validFrames++
                } else {
                    corruptedFrames++
                    errors.add("CRC mismatch at frame $frameIndex")
                }

                offset += XRawWriter.FRAME_HEADER_SIZE + dataSize
            }

            return ValidationResult(
                valid = headerValid && corruptedFrames == 0,
                headerValid = headerValid,
                frameCount = frameCount,
                validFrames = validFrames,
                corruptedFrames = corruptedFrames,
                width = width,
                height = height,
                bitDepth = bitDepth,
                compressionId = compressionId,
                errors = errors
            )

        } finally {
            raf.close()
        }
    }
}
