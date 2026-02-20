package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CampaignRepositoryTest {

    private lateinit var campaignDao: CampaignDao
    private lateinit var campaignApi: CampaignApi
    private lateinit var repository: CampaignRepository

    @Before
    fun setup() {
        campaignDao = mockk(relaxed = true)
        campaignApi = mockk()
        repository = CampaignRepository(campaignDao, campaignApi)
    }

    @Test
    fun `getActiveCampaigns returns mapped domain objects`() = runTest {
        val entities = listOf(
            CampaignEntity(
                id = "c1",
                tenantId = "t1",
                name = "FMD Surveillance Q1",
                domain = "animal-health",
                templateId = "tmpl-1",
                startDate = 1700000000000,
                endDate = 1710000000000,
                status = "ACTIVE",
                syncedAt = 1700000000000,
            ),
        )
        coEvery { campaignDao.getActiveCampaigns() } returns flowOf(entities)

        val campaigns = repository.getActiveCampaigns().first()

        assertEquals(1, campaigns.size)
        assertEquals("c1", campaigns[0].id)
        assertEquals("FMD Surveillance Q1", campaigns[0].name)
        assertEquals("animal-health", campaigns[0].domain)
    }

    @Test
    fun `refreshCampaigns fetches from API and stores in DB`() = runTest {
        val dtos = listOf(
            CampaignDto(
                id = "c2",
                tenantId = "t1",
                name = "PPR Campaign",
                domain = "animal-health",
                templateId = "tmpl-2",
                startDate = 1700000000000,
                endDate = 1710000000000,
                status = "ACTIVE",
            ),
        )
        coEvery { campaignApi.getActiveCampaigns() } returns ApiResponse(data = dtos)

        val result = repository.refreshCampaigns()

        assertTrue(result.isSuccess)
        coVerify { campaignDao.upsertAll(match { it.size == 1 && it[0].id == "c2" }) }
    }

    @Test
    fun `refreshCampaigns returns failure on API error`() = runTest {
        coEvery { campaignApi.getActiveCampaigns() } throws RuntimeException("Network error")

        val result = repository.refreshCampaigns()

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
