package org.auibar.aris.mobile.ui.paid

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardRepository
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PaidDashboardViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var campaignRepository: CampaignRepository
    private lateinit var dashboardRepository: DashboardRepository

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        campaignRepository = mockk(relaxed = true)
        dashboardRepository = mockk(relaxed = true)

        every { campaignRepository.getActiveCampaignsByDomain("paid") } returns flowOf(emptyList())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): PaidDashboardViewModel {
        return PaidDashboardViewModel(campaignRepository, dashboardRepository)
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private fun makeCampaign(
        id: String = "c1",
        name: String = "PAID Campaign",
        status: String = "ACTIVE",
        targetSubmissions: Int? = 100,
        totalSubmissions: Int = 50,
        validatedSubmissions: Int = 30,
        rejectedSubmissions: Int = 5,
    ) = Campaign(
        id = id,
        tenantId = "t1",
        name = name,
        domain = "paid",
        templateId = "tmpl-1",
        startDate = 1700000000000,
        endDate = 1710000000000,
        status = status,
        targetSubmissions = targetSubmissions,
        totalSubmissions = totalSubmissions,
        validatedSubmissions = validatedSubmissions,
        rejectedSubmissions = rejectedSubmissions,
    )

    // ── 1. init loads paid stats and sets isLoading false ────────────

    @Test
    fun `init loads paid stats and sets isLoading false`() = runTest {
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(emptyList())

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.error)
    }

    // ── 2. campaigns flow filters by paid domain ────────────────────

    @Test
    fun `campaigns flow filters by paid domain`() = runTest {
        val paidCampaigns = listOf(makeCampaign(id = "c1"), makeCampaign(id = "c2"))
        every { campaignRepository.getActiveCampaignsByDomain("paid") } returns flowOf(paidCampaigns)
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(emptyList())

        val vm = createViewModel()
        val job = launch { vm.campaigns.collect {} }
        advanceUntilIdle()

        assertEquals(2, vm.campaigns.value.size)
        assertEquals("c1", vm.campaigns.value[0].id)
        assertEquals("c2", vm.campaigns.value[1].id)
        job.cancel()
    }

    // ── 3. stats computed from real campaign data when no server KPIs ─

    @Test
    fun `stats computed from real campaign data when no server KPIs`() = runTest {
        val campaigns = listOf(
            makeCampaign(
                id = "c1",
                status = "ACTIVE",
                targetSubmissions = 100,
                totalSubmissions = 80,
                validatedSubmissions = 40,
                rejectedSubmissions = 10,
            ),
            makeCampaign(
                id = "c2",
                status = "ACTIVE",
                targetSubmissions = 200,
                totalSubmissions = 150,
                validatedSubmissions = 100,
                rejectedSubmissions = 20,
            ),
        )
        every { campaignRepository.getActiveCampaignsByDomain("paid") } returns flowOf(campaigns)
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(emptyList())

        val vm = createViewModel()
        // Collect campaigns so .value is populated before loadPaidStats reads it
        val job = launch { vm.campaigns.collect {} }
        advanceUntilIdle()

        val state = vm.uiState.value
        // Both campaigns are ACTIVE
        assertEquals(2, state.activeCampaigns)
        // totalSubmissions = 80 + 150
        assertEquals(230, state.totalSubmissions)
        assertFalse(state.isLoading)
        assertNull(state.error)
        // campaignStats mapped from campaigns
        assertEquals(2, state.campaignStats.size)
        assertEquals("c1", state.campaignStats[0].id)
        assertEquals("c2", state.campaignStats[1].id)
        job.cancel()
    }

    // ── 4. stats use server KPIs when available ─────────────────────

    @Test
    fun `stats use server KPIs when available`() = runTest {
        val kpis = listOf(
            KpiCard(key = "active_campaigns", label = "Active Campaigns", value = 5.0),
            KpiCard(key = "total_submissions", label = "Total Submissions", value = 999.0),
            KpiCard(key = "completion_rate", label = "Completion Rate", value = 75.0),
        )
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(kpis)

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(5, state.activeCampaigns)
        assertEquals(999, state.totalSubmissions)
        // 75.0 / 100 = 0.75f
        assertEquals(0.75f, state.completionRate, 0.001f)
        assertFalse(state.isLoading)
        assertNull(state.error)
    }

    // ── 5. loadPaidStats error sets error state ─────────────────────

    @Test
    fun `loadPaidStats error sets error state`() = runTest {
        coEvery { dashboardRepository.getDomainKpis("paid") } throws RuntimeException("Network error")

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Network error", state.error)
    }

    // ── 6. refresh calls loadPaidStats again ────────────────────────

    @Test
    fun `refresh calls loadPaidStats again`() = runTest {
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(emptyList())

        val vm = createViewModel()
        advanceUntilIdle()

        // After init, call refresh
        vm.refresh()
        advanceUntilIdle()

        // getDomainKpis called twice: once in init, once on refresh
        coVerify(exactly = 2) { dashboardRepository.getDomainKpis("paid") }
    }

    // ── 7. empty campaign list produces zero stats ──────────────────

    @Test
    fun `empty campaign list produces zero stats`() = runTest {
        every { campaignRepository.getActiveCampaignsByDomain("paid") } returns flowOf(emptyList())
        coEvery { dashboardRepository.getDomainKpis("paid") } returns Result.success(emptyList())

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(0, state.activeCampaigns)
        assertEquals(0, state.totalSubmissions)
        assertEquals(0f, state.completionRate, 0.001f)
        assertTrue(state.campaignStats.isEmpty())
        assertFalse(state.isLoading)
        assertNull(state.error)
    }
}
