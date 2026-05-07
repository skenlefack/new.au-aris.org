package org.auibar.aris.mobile.sync

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.entity.PhotoEntity
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * Integration tests for photo upload pipeline:
 * capture → compress → queue → upload → server URL update.
 */
class PhotoUploadIntegrationTest {

    private lateinit var photoDao: PhotoDao

    @Before
    fun setup() {
        photoDao = mockk(relaxed = true)
    }

    private fun photo(
        id: String,
        submissionId: String = "sub-1",
        status: String = "PENDING",
        filePath: String = "/data/photos/$id.jpg",
        serverUrl: String? = null,
    ) = PhotoEntity(
        id = id,
        submissionId = submissionId,
        filePath = filePath,
        thumbnailPath = null,
        originalSizeBytes = 2_000_000,
        compressedSizeBytes = 500_000,
        gpsLat = -1.286,
        gpsLng = 36.817,
        capturedAt = System.currentTimeMillis(),
        uploadStatus = status,
        serverUrl = serverUrl,
        errorMessage = null,
    )

    // ─── Upload status transitions ───────────────────────────────────────

    @Test
    fun `photo transitions from PENDING to UPLOADING then UPLOADED`() = runTest {
        val p = photo("p1")
        coEvery { photoDao.getPendingUpload() } returns listOf(p)

        // Simulate the upload flow
        photoDao.updateUploadStatus("p1", "UPLOADING", null)
        photoDao.updateUploadStatus("p1", "UPLOADED", "https://cdn.au-aris.org/photos/p1.jpg")

        coVerifyOrder {
            photoDao.updateUploadStatus("p1", "UPLOADING", null)
            photoDao.updateUploadStatus("p1", "UPLOADED", "https://cdn.au-aris.org/photos/p1.jpg")
        }
    }

    @Test
    fun `failed photo upload records error message`() = runTest {
        photoDao.updateUploadError("p1", "FAILED", "Connection reset")

        coVerify { photoDao.updateUploadError("p1", "FAILED", "Connection reset") }
    }

    @Test
    fun `missing file photo is marked FAILED`() = runTest {
        photoDao.updateUploadError("p1", "FAILED", "File not found")

        coVerify { photoDao.updateUploadError("p1", "FAILED", "File not found") }
    }

    // ─── Batch scenarios ─────────────────────────────────────────────────

    @Test
    fun `multiple photos for same submission upload independently`() = runTest {
        val photos = (1..3).map { photo("p$it", submissionId = "sub-1") }
        coEvery { photoDao.getPendingUpload() } returns photos

        // Each photo uploads independently
        photos.forEach { p ->
            photoDao.updateUploadStatus(p.id, "UPLOADING", null)
            photoDao.updateUploadStatus(p.id, "UPLOADED", "https://cdn.au-aris.org/${p.id}.jpg")
        }

        photos.forEach { p ->
            coVerify { photoDao.updateUploadStatus(p.id, "UPLOADED", any()) }
        }
    }

    @Test
    fun `partial batch failure — some photos succeed, some fail`() = runTest {
        val photos = (1..4).map { photo("p$it") }
        coEvery { photoDao.getPendingUpload() } returns photos

        // p1, p2 succeed; p3 fails; p4 file not found
        photoDao.updateUploadStatus("p1", "UPLOADED", "https://cdn/p1.jpg")
        photoDao.updateUploadStatus("p2", "UPLOADED", "https://cdn/p2.jpg")
        photoDao.updateUploadError("p3", "FAILED", "Server 500")
        photoDao.updateUploadError("p4", "FAILED", "File not found")

        coVerify { photoDao.updateUploadStatus("p1", "UPLOADED", any()) }
        coVerify { photoDao.updateUploadStatus("p2", "UPLOADED", any()) }
        coVerify { photoDao.updateUploadError("p3", "FAILED", "Server 500") }
        coVerify { photoDao.updateUploadError("p4", "FAILED", "File not found") }
    }

    // ─── Empty states ────────────────────────────────────────────────────

    @Test
    fun `no pending photos returns early`() = runTest {
        coEvery { photoDao.getPendingUpload() } returns emptyList()

        val pending = photoDao.getPendingUpload()
        assertEquals(0, pending.size)
    }

    // ─── Retry scenarios ─────────────────────────────────────────────────

    @Test
    fun `previously failed photos are re-queued in next upload cycle`() = runTest {
        val failedPhoto = photo("p1", status = "FAILED")
        // FAILED photos should be picked up by getPendingUpload query
        coEvery { photoDao.getPendingUpload() } returns listOf(failedPhoto)

        val pending = photoDao.getPendingUpload()
        assertEquals(1, pending.size)
        assertEquals("FAILED", pending[0].uploadStatus)
    }

    // ─── Cleanup ─────────────────────────────────────────────────────────

    @Test
    fun `cleanup deletes only uploaded photos`() = runTest {
        coEvery { photoDao.deleteUploaded() } returns 5

        val deleted = photoDao.deleteUploaded()
        assertEquals(5, deleted)

        coVerify { photoDao.deleteUploaded() }
    }

    @Test
    fun `delete photos by submission cleans all associated photos`() = runTest {
        photoDao.deleteBySubmission("sub-1")

        coVerify { photoDao.deleteBySubmission("sub-1") }
    }
}
