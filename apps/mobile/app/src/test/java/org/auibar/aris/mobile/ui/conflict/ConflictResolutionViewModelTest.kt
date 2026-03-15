package org.auibar.aris.mobile.ui.conflict

import androidx.lifecycle.SavedStateHandle
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ConflictResolutionViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var submissionRepository: SubmissionRepository
    private val submissionId = "sub-123"

    private val localData = """{"species":"cattle","count":"50","location":"Nairobi"}"""
    private val serverData = """{"species":"cattle","count":"75","location":"Mombasa"}"""

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        submissionRepository = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): ConflictResolutionViewModel {
        val savedStateHandle = SavedStateHandle(mapOf("submissionId" to submissionId))
        return ConflictResolutionViewModel(savedStateHandle, submissionRepository)
    }

    private fun mockConflictSubmission() {
        coEvery { submissionRepository.getById(submissionId) } returns Submission(
            id = submissionId,
            campaignId = "campaign-1",
            templateId = "tmpl-1",
            data = localData,
            gpsLat = -1.2921,
            gpsLng = 36.8219,
            offlineCreatedAt = 1700000000000,
            syncStatus = "CONFLICT",
            serverErrors = null,
            serverData = serverData,
        )
    }

    @Test
    fun `loads conflict and computes field diffs`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        val state = vm.state.value
        assertFalse(state.isLoading)
        assertEquals(3, state.fields.size)

        // species is the same
        val speciesField = state.fields.find { it.key == "species" }!!
        assertFalse(speciesField.isDifferent)
        assertEquals("cattle", speciesField.localValue)
        assertEquals("cattle", speciesField.serverValue)

        // count differs
        val countField = state.fields.find { it.key == "count" }!!
        assertTrue(countField.isDifferent)
        assertEquals("50", countField.localValue)
        assertEquals("75", countField.serverValue)

        // location differs
        val locField = state.fields.find { it.key == "location" }!!
        assertTrue(locField.isDifferent)
        assertEquals("Nairobi", locField.localValue)
        assertEquals("Mombasa", locField.serverValue)

        assertEquals(2, state.diffCount)
    }

    @Test
    fun `toggleFieldChoice switches between local and server`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        // Initially all useLocal = true
        assertTrue(vm.state.value.fields.find { it.key == "count" }!!.useLocal)

        vm.toggleFieldChoice("count")

        assertFalse(vm.state.value.fields.find { it.key == "count" }!!.useLocal)

        vm.toggleFieldChoice("count")

        assertTrue(vm.state.value.fields.find { it.key == "count" }!!.useLocal)
    }

    @Test
    fun `selectAllServer sets all fields to use server value`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        vm.selectAllServer()

        vm.state.value.fields.forEach { field ->
            assertFalse("${field.key} should use server", field.useLocal)
        }
    }

    @Test
    fun `confirmAction KEEP_LOCAL resolves with local data`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        val events = mutableListOf<ConflictEvent>()
        val job = launch { vm.events.collect { events.add(it) } }

        vm.showConfirmDialog(ConfirmAction.KEEP_LOCAL)
        vm.confirmAction()
        advanceUntilIdle()

        coVerify { submissionRepository.resolveConflict(submissionId, localData) }
        assertTrue(events.any { it is ConflictEvent.Resolved })
        job.cancel()
    }

    @Test
    fun `confirmAction ACCEPT_SERVER resolves with server data`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        val events = mutableListOf<ConflictEvent>()
        val job = launch { vm.events.collect { events.add(it) } }

        vm.showConfirmDialog(ConfirmAction.ACCEPT_SERVER)
        vm.confirmAction()
        advanceUntilIdle()

        coVerify { submissionRepository.resolveConflict(submissionId, serverData) }
        assertTrue(events.any { it is ConflictEvent.Resolved })
        job.cancel()
    }

    @Test
    fun `confirmAction DISCARD deletes the submission`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        val events = mutableListOf<ConflictEvent>()
        val job = launch { vm.events.collect { events.add(it) } }

        vm.showConfirmDialog(ConfirmAction.DISCARD)
        vm.confirmAction()
        advanceUntilIdle()

        coVerify { submissionRepository.discardConflict(submissionId) }
        assertTrue(events.any { it is ConflictEvent.Discarded })
        job.cancel()
    }

    @Test
    fun `resolveMerged builds JSON from per-field choices`() = runTest {
        mockConflictSubmission()
        val vm = createViewModel()
        advanceUntilIdle()

        // Keep local for count (50), switch to server for location (Mombasa)
        vm.toggleFieldChoice("location")

        val events = mutableListOf<ConflictEvent>()
        val job = launch { vm.events.collect { events.add(it) } }

        vm.resolveMerged()
        advanceUntilIdle()

        coVerify {
            submissionRepository.resolveConflict(submissionId, match { merged ->
                merged.contains("\"count\":\"50\"") &&
                merged.contains("\"location\":\"Mombasa\"") &&
                merged.contains("\"species\":\"cattle\"")
            })
        }
        assertTrue(events.any { it is ConflictEvent.Resolved })
        job.cancel()
    }
}
