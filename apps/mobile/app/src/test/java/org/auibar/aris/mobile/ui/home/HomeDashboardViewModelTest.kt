package org.auibar.aris.mobile.ui.home

import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.DashboardRepository
import org.auibar.aris.mobile.util.TokenManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeDashboardViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var dashboardRepository: DashboardRepository
    private lateinit var tokenManager: TokenManager

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        dashboardRepository = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)

        every { dashboardRepository.getPendingCount() } returns flowOf(0)
        every { tokenManager.getUserDomainList() } returns emptyList()
        every { tokenManager.getActiveDomainCodes() } returns emptyList()
        every { tokenManager.userRole } returns "NATIONAL_ADMIN"
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `init loads KPIs from repository`() = runTest {
        val kpis = listOf(
            KpiCard(key = "active_outbreaks", label = "Active Outbreaks", value = 42.0, unit = "outbreaks"),
            KpiCard(key = "livestock_population", label = "Livestock", value = 1500000.0, unit = "heads"),
        )
        coEvery { dashboardRepository.getContinentalKpis() } returns Result.success(kpis)

        val vm = HomeDashboardViewModel(dashboardRepository, tokenManager)
        advanceUntilIdle()

        assertEquals(2, vm.kpis.value.size)
        assertEquals("active_outbreaks", vm.kpis.value[0].key)
        assertFalse(vm.isLoading.value)
    }

    @Test
    fun `init sets empty kpis on failure`() = runTest {
        coEvery { dashboardRepository.getContinentalKpis() } returns Result.failure(RuntimeException("Network error"))

        val vm = HomeDashboardViewModel(dashboardRepository, tokenManager)
        advanceUntilIdle()

        assertTrue(vm.kpis.value.isEmpty())
        assertFalse(vm.isLoading.value)
    }

    @Test
    fun `pendingCount reflects repository flow`() = runTest {
        every { dashboardRepository.getPendingCount() } returns flowOf(5)
        coEvery { dashboardRepository.getContinentalKpis() } returns Result.success(emptyList())

        val vm = HomeDashboardViewModel(dashboardRepository, tokenManager)
        advanceUntilIdle()

        assertEquals(5, vm.pendingCount.value)
    }

    @Test
    fun `refresh reloads KPIs`() = runTest {
        var callCount = 0
        coEvery { dashboardRepository.getContinentalKpis() } answers {
            callCount++
            Result.success(listOf(KpiCard(key = "k$callCount", label = "Label", value = callCount.toDouble(), unit = "")))
        }

        val vm = HomeDashboardViewModel(dashboardRepository, tokenManager)
        advanceUntilIdle()
        assertEquals(1, vm.kpis.value.size)

        vm.refresh()
        advanceUntilIdle()
        assertEquals(1, vm.kpis.value.size)
        assertEquals("k2", vm.kpis.value[0].key)
    }

    @Test
    fun `userDomains reflects tokenManager`() = runTest {
        every { tokenManager.getUserDomainList() } returns listOf("animal-health", "fisheries")
        coEvery { dashboardRepository.getContinentalKpis() } returns Result.success(emptyList())

        val vm = HomeDashboardViewModel(dashboardRepository, tokenManager)
        advanceUntilIdle()

        assertEquals(listOf("animal-health", "fisheries"), vm.userDomains)
    }
}
