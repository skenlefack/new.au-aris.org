package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.ReferentialUpdates
import org.auibar.aris.mobile.data.remote.dto.RejectedSubmission
import org.auibar.aris.mobile.data.remote.dto.SyncResponse
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SyncRepositoryTest {

    private lateinit var syncApi: SyncApi
    private lateinit var submissionDao: SubmissionDao
    private lateinit var campaignDao: CampaignDao
    private lateinit var formTemplateDao: FormTemplateDao
    private lateinit var speciesDao: SpeciesDao
    private lateinit var diseaseDao: DiseaseDao
    private lateinit var geoDao: GeoDao
    private lateinit var tokenManager: TokenManager
    private lateinit var repository: SyncRepository

    @Before
    fun setup() {
        syncApi = mockk()
        submissionDao = mockk(relaxed = true)
        campaignDao = mockk(relaxed = true)
        formTemplateDao = mockk(relaxed = true)
        speciesDao = mockk(relaxed = true)
        diseaseDao = mockk(relaxed = true)
        geoDao = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)
        repository = SyncRepository(
            syncApi, submissionDao, campaignDao, formTemplateDao,
            speciesDao, diseaseDao, geoDao, tokenManager,
        )
    }

    @Test
    fun `performSync marks accepted submissions as SYNCED`() = runTest {
        val pending = listOf(
            SubmissionEntity("s1", "t1", "c1", "tmpl1", "{}", null, null, null, 1000, null, "PENDING", null),
        )
        coEvery { submissionDao.getPendingSync() } returns pending
        every { tokenManager.lastSyncAt } returns null

        val syncResponse = SyncResponse(
            accepted = listOf("s1"),
            rejected = emptyList(),
            conflicts = emptyList(),
            updatedCampaigns = emptyList(),
            updatedTemplates = emptyList(),
            updatedReferentials = ReferentialUpdates(),
        )
        coEvery { syncApi.sync(any()) } returns ApiResponse(data = syncResponse)

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()?.accepted)
        coVerify { submissionDao.updateSyncStatus("s1", "SYNCED", any()) }
    }

    @Test
    fun `performSync marks rejected submissions as FAILED`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        val syncResponse = SyncResponse(
            accepted = emptyList(),
            rejected = listOf(RejectedSubmission("s2", listOf("Missing species"))),
            conflicts = emptyList(),
            updatedCampaigns = emptyList(),
            updatedTemplates = emptyList(),
            updatedReferentials = ReferentialUpdates(),
        )
        coEvery { syncApi.sync(any()) } returns ApiResponse(data = syncResponse)

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()?.rejected)
        coVerify { submissionDao.updateSyncError("s2", "FAILED", "Missing species") }
    }

    @Test
    fun `performSync returns failure on network error`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } throws RuntimeException("No network")

        val result = repository.performSync()

        assertTrue(result.isFailure)
        assertEquals("No network", result.exceptionOrNull()?.message)
    }
}
