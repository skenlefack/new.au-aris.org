package org.auibar.aris.mobile.data.repository

import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class SubmissionRepositoryTest {

    private lateinit var submissionDao: SubmissionDao
    private lateinit var repository: SubmissionRepository

    @Before
    fun setup() {
        submissionDao = mockk(relaxed = true)
        repository = SubmissionRepository(submissionDao)
    }

    @Test
    fun `getAll returns mapped submissions`() = runTest {
        val entities = listOf(
            SubmissionEntity(
                id = "s1",
                tenantId = "t1",
                campaignId = "c1",
                templateId = "tmpl-1",
                data = """{"species":"cattle","count":50}""",
                gpsLat = -1.2921,
                gpsLng = 36.8219,
                gpsAccuracy = 5.0f,
                offlineCreatedAt = 1700000000000,
                syncedAt = null,
                syncStatus = "PENDING",
                serverErrors = null,
            ),
        )
        every { submissionDao.getAll() } returns flowOf(entities)

        val submissions = repository.getAll().first()

        assertEquals(1, submissions.size)
        assertEquals("s1", submissions[0].id)
        assertEquals("PENDING", submissions[0].syncStatus)
        assertEquals(-1.2921, submissions[0].gpsLat!!, 0.001)
        assertNull(submissions[0].serverErrors)
    }

    @Test
    fun `getByCampaign filters by campaignId`() = runTest {
        val entities = listOf(
            SubmissionEntity(
                id = "s2",
                tenantId = "t1",
                campaignId = "c1",
                templateId = "tmpl-1",
                data = "{}",
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
                offlineCreatedAt = 1700000000000,
                syncedAt = 1700001000000,
                syncStatus = "SYNCED",
                serverErrors = null,
            ),
        )
        every { submissionDao.getByCampaign("c1") } returns flowOf(entities)

        val submissions = repository.getByCampaign("c1").first()

        assertEquals(1, submissions.size)
        assertEquals("SYNCED", submissions[0].syncStatus)
    }

    @Test
    fun `createSubmission inserts entity with PENDING status`() = runTest {
        repository.createSubmission(
            id = "s3",
            tenantId = "t1",
            campaignId = "c1",
            templateId = "tmpl-1",
            data = """{"field":"value"}""",
            gpsLat = 0.3476,
            gpsLng = 32.5825,
            gpsAccuracy = 10.0f,
        )

        coVerify {
            submissionDao.insert(match {
                it.id == "s3" &&
                it.syncStatus == "PENDING" &&
                it.syncedAt == null &&
                it.tenantId == "t1" &&
                it.gpsLat == 0.3476
            })
        }
    }

    @Test
    fun `getPendingCount returns flow from dao`() = runTest {
        every { submissionDao.getPendingCount() } returns flowOf(5)

        val count = repository.getPendingCount().first()

        assertEquals(5, count)
    }
}
