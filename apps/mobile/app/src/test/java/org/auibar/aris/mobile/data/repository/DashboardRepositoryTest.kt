package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.cache.CachePolicy
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.remote.dto.KpiResponse
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DashboardRepositoryTest {

    private lateinit var analyticsApi: AnalyticsApi
    private lateinit var campaignRepository: CampaignRepository
    private lateinit var submissionRepository: SubmissionRepository
    private lateinit var cachePolicy: CachePolicy
    private lateinit var tokenManager: TokenManager
    private lateinit var repository: DashboardRepository

    private val sampleKpis = listOf(
        KpiCard(key = "outbreaks", label = "Active Outbreaks", value = 12.0),
        KpiCard(key = "reports", label = "Total Reports", value = 340.0),
    )

    @Before
    fun setup() {
        analyticsApi = mockk(relaxed = true)
        campaignRepository = mockk(relaxed = true)
        submissionRepository = mockk(relaxed = true)
        cachePolicy = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)

        every { cachePolicy.kpiTtlMs } returns 5 * 60 * 1000L
        every { campaignRepository.getActiveCampaigns() } returns flowOf(emptyList())
        every { submissionRepository.getPendingCount() } returns flowOf(0)
        every { tokenManager.getUserDomainList() } returns emptyList()

        repository = DashboardRepository(
            analyticsApi,
            campaignRepository,
            submissionRepository,
            cachePolicy,
            tokenManager,
        )
    }

    private fun mockHealthKpis(kpis: List<KpiCard> = sampleKpis) {
        coEvery { analyticsApi.getHealthKpis() } returns ApiResponse(
            data = KpiResponse(kpis = kpis, asOf = "2026-03-23T12:00:00Z"),
        )
    }

    @Test
    fun `getKpis fetches from API on first call`() = runTest {
        mockHealthKpis()

        val result = repository.getKpis()

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()!!.size)
        assertEquals("Active Outbreaks", result.getOrNull()!![0].label)
        coVerify(exactly = 1) { analyticsApi.getHealthKpis() }
    }

    @Test
    fun `getKpis returns cached data on second call within TTL`() = runTest {
        mockHealthKpis()

        repository.getKpis() // first call - fetches
        repository.getKpis() // second call - should use cache

        // Only one API call should have been made
        coVerify(exactly = 1) { analyticsApi.getHealthKpis() }
    }

    @Test
    fun `getKpis with forceRefresh bypasses cache`() = runTest {
        mockHealthKpis()

        repository.getKpis()
        repository.getKpis(forceRefresh = true)

        coVerify(exactly = 2) { analyticsApi.getHealthKpis() }
    }

    @Test
    fun `getKpis returns stale cache on network error`() = runTest {
        mockHealthKpis()
        repository.getKpis() // populate cache

        coEvery { analyticsApi.getHealthKpis() } throws RuntimeException("Offline")

        val result = repository.getKpis(forceRefresh = true)

        // Should return stale cached data instead of error
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()!!.size)
    }

    @Test
    fun `getKpis returns failure when no cache and network error`() = runTest {
        coEvery { analyticsApi.getHealthKpis() } throws RuntimeException("Offline")

        val result = repository.getKpis()

        assertTrue(result.isFailure)
    }

    @Test
    fun `getDomainKpis caches per domain key`() = runTest {
        coEvery { analyticsApi.getDomainKpis("health") } returns ApiResponse(
            data = KpiResponse(kpis = sampleKpis, asOf = "2026-03-23T12:00:00Z"),
        )
        coEvery { analyticsApi.getDomainKpis("livestock") } returns ApiResponse(
            data = KpiResponse(
                kpis = listOf(KpiCard(key = "census", label = "Census", value = 100.0)),
                asOf = "2026-03-23T12:00:00Z",
            ),
        )

        val healthResult = repository.getDomainKpis("health")
        val livestockResult = repository.getDomainKpis("livestock")

        assertEquals(2, healthResult.getOrNull()!!.size)
        assertEquals(1, livestockResult.getOrNull()!!.size)

        // Second calls should use cache
        repository.getDomainKpis("health")
        repository.getDomainKpis("livestock")

        coVerify(exactly = 1) { analyticsApi.getDomainKpis("health") }
        coVerify(exactly = 1) { analyticsApi.getDomainKpis("livestock") }
    }

    @Test
    fun `invalidateKpiCache clears all cached entries`() = runTest {
        mockHealthKpis()
        repository.getKpis() // populate cache

        repository.invalidateKpiCache()
        repository.getKpis() // should fetch again

        coVerify(exactly = 2) { analyticsApi.getHealthKpis() }
    }

    @Test
    fun `getContinentalKpis caches independently`() = runTest {
        coEvery { analyticsApi.getContinentalKpis() } returns ApiResponse(
            data = KpiResponse(kpis = sampleKpis, asOf = "2026-03-23T12:00:00Z"),
        )

        repository.getContinentalKpis()
        repository.getContinentalKpis()

        coVerify(exactly = 1) { analyticsApi.getContinentalKpis() }
    }
}
