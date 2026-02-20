package org.auibar.aris.mobile.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoCompressorTest {

    @Test
    fun `MAX_SIZE_BYTES is 1MB`() {
        assertEquals(1_000_000L, PhotoCompressor.MAX_SIZE_BYTES)
    }

    @Test
    fun `MAX_DIMENSION is 1920`() {
        assertEquals(1920, PhotoCompressor.MAX_DIMENSION)
    }

    @Test
    fun `INITIAL_QUALITY is 85`() {
        assertEquals(85, PhotoCompressor.INITIAL_QUALITY)
    }

    @Test
    fun `MIN_QUALITY is 30`() {
        assertEquals(30, PhotoCompressor.MIN_QUALITY)
    }

    @Test
    fun `QUALITY_STEP is 10`() {
        assertEquals(10, PhotoCompressor.QUALITY_STEP)
    }

    @Test
    fun `CompressResult holds correct data`() {
        val result = PhotoCompressor.CompressResult(
            filePath = "/tmp/test.jpg",
            sizeBytes = 500_000L,
            wasCompressed = true,
        )
        assertEquals("/tmp/test.jpg", result.filePath)
        assertEquals(500_000L, result.sizeBytes)
        assertTrue(result.wasCompressed)
    }

    @Test
    fun `CompressResult wasCompressed false when not compressed`() {
        val result = PhotoCompressor.CompressResult(
            filePath = "/tmp/original.jpg",
            sizeBytes = 800_000L,
            wasCompressed = false,
        )
        assertFalse(result.wasCompressed)
    }
}
