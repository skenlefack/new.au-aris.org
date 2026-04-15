package org.auibar.aris.mobile.ui.dashboard

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
import org.auibar.aris.mobile.data.cache.CampaignRefresher
import org.auibar.aris.mobile.data.cache.MasterDataRefresher
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardRepository
import org.auibar.aris.mobile.util.TokenManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var dashboardRepository: DashboardRepository
    private lateinit var masterDataRefresher: MasterDataRefresher
    private lateinit var campaignRefresher: CampaignRefresher
    private lateinit var campaignRepository: CampaignRepository
    private lateinit var tokenManager: TokenManager
    private lateinit var authRepository: AuthRepository

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        dashboardRepository = mockk(relaxed = true)
        masterDataRefresher = mockk(relaxed = true)
        campaignRefresher = mockk(relaxed = true)
        campaignRepository = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)

        every { tokenManager.userFullName } returns "Test User"
        every { tokenManager.userEmail } returns "test@au-aris.org"
        every { tokenManager.userRole } returns "FIELD_AGENT"
        every { tokenManager.tenantLevel } returns "MEMBER_STATE"
        every { dashboardRepository.getActiveCampaigns() } returns flowOf(emptyList())
        every { dashboardRepository.getPendingCount() } returns flowOf(0)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): DashboardViewModel {
        return DashboardViewModel(
            dashboardRepository,
            masterDataRefresher,
            campaignRefresher,
            campaignRepository,
            tokenManager,
            authRepository,
        )
    }

    @Test
    fun `init populates user info from token manager`() = runTest {
        coEvery { dashboardRepository.getKpis(any()) } returns Result.success(emptyList())

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals("Test User", state.userName)
        assertEquals("test@au-aris.org", state.userEmail)
        assertEquals("FIELD_AGENT", state.userRole)
        assertEquals("MEMBER_STATE", state.tenantLevel)
    }

    @Test
    fun `init refreshes master data and campaigns`() = runTest {
        coEvery { dashboardRepository.getKpis(any()) } returns Result.success(emptyList())

        createViewModel()
        advanceUntilIdle()

        coVerify { masterDataRefresher.refreshIfNeeded() }
        coVerify { campaignRefresher.forceRefresh() }
        coVerify { campaignRepository.refreshCampaigns() }
    }

    @Test
    fun `loadKpis success updates state with kpis`() = runTest {
        val kpis = listOf(
            KpiCard(key = "active_outbreaks", label = "Outbreaks", value = 42.0, trend = "up"),
            KpiCard(key = "vaccinations", label = "Vaccinations", value = 1200.0, trend = "stable"),
        )
        coEvery { dashboardRepository.getKpis() } returns Result.success(kpis)

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(2, state.kpis.size)
        assertEquals("Outbreaks", state.kpis[0].label)
        assertEquals(42.0, state.kpis[0].value, 0.01)
        assertFalse(state.isLoading)
        assertNull(state.error)
    }

    @Test
    fun `loadKpis failure sets error`() = runTest {
        coEvery { dashboardRepository.getKpis(any()) } returns Result.failure(
            RuntimeException("Network error"),
        )

        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertTrue(state.kpis.isEmpty())
        assertFalse(state.isLoading)
        assertEquals("Network error", state.error)
    }

    @Test
    fun `logout calls auth repository`() = runTest {
        coEvery { dashboardRepository.getKpis(any()) } returns Result.success(emptyList())

        val vm = createViewModel()
        advanceUntilIdle()

        vm.logout()

        coVerify { authRepository.logout() }
    }

    @Test
    fun `pendingCount reflects repository flow`() = runTest {
        every { dashboardRepository.getPendingCount() } returns flowOf(7)
        coEvery { dashboardRepository.getKpis(any()) } returns Result.success(emptyList())

        val vm = createViewModel()
        val job = launch { vm.pendingCount.collect {} }
        advanceUntilIdle()

        assertEquals(7, vm.pendingCount.value)
        job.cancel()
    }
}
