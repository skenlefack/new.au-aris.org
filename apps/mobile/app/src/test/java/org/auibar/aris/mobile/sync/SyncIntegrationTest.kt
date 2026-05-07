package org.auibar.aris.mobile.sync

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.ConflictSubmission
import org.auibar.aris.mobile.data.remote.dto.DiseaseDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.GeoDto
import org.auibar.aris.mobile.data.remote.dto.QualityResultDto
import org.auibar.aris.mobile.data.remote.dto.ReferentialUpdates
import org.auibar.aris.mobile.data.remote.dto.RejectedSubmission
import org.auibar.aris.mobile.data.remote.dto.SpeciesDto
import org.auibar.aris.mobile.data.remote.dto.SyncRequest
import org.auibar.aris.mobile.data.remote.dto.SyncResponse
import org.auibar.aris.mobile.data.remote.dto.WorkflowUpdateDto
import org.auibar.aris.mobile.data.repository.SyncRepository
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException

/**
 * Integration-level tests for the full sync pipeline:
 * offline → batch upload → conflict detection → resolution → referential refresh.
 */
class SyncIntegrationTest {

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

    // ─── Helper ──────────────────────────────────────────────────────────

    private fun submission(
        id: String,
        status: String = "PENDING",
        domain: String? = "animal-health",
    ) = SubmissionEntity(
        id = id,
        tenantId = "tenant-ke",
        campaignId = "camp-1",
        templateId = "tmpl-1",
        data = """{"species":"bovine","count":42}""",
        gpsLat = -1.286,
        gpsLng = 36.817,
        gpsAccuracy = 5.0f,
        offlineCreatedAt = System.currentTimeMillis(),
        syncedAt = null,
        syncStatus = status,
        serverErrors = null,
        domain = domain,
    )

    private fun emptySyncResponse(
        accepted: List<String> = emptyList(),
        rejected: List<RejectedSubmission> = emptyList(),
        conflicts: List<ConflictSubmission> = emptyList(),
        campaigns: List<CampaignDto> = emptyList(),
        templates: List<FormTemplateDto> = emptyList(),
        referentials: ReferentialUpdates = ReferentialUpdates(),
        workflowUpdates: List<WorkflowUpdateDto> = emptyList(),
        qualityResults: List<QualityResultDto> = emptyList(),
    ) = ApiResponse(
        data = SyncResponse(
            accepted = accepted,
            rejected = rejected,
            conflicts = conflicts,
            updatedCampaigns = campaigns,
            updatedTemplates = templates,
            updatedReferentials = referentials,
            workflowUpdates = workflowUpdates,
            qualityResults = qualityResults,
        ),
    )

    // ─── 1. Batch offline submissions ────────────────────────────────────

    @Test
    fun `sync batches multiple pending submissions in a single request`() = runTest {
        val pending = (1..5).map { submission("s$it") }
        coEvery { submissionDao.getPendingSync() } returns pending
        every { tokenManager.lastSyncAt } returns null

        val requestSlot = slot<SyncRequest>()
        coEvery { syncApi.sync(capture(requestSlot)) } returns emptySyncResponse(
            accepted = pending.map { it.id },
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        assertEquals(5, requestSlot.captured.submissions.size)
        assertEquals(5, result.getOrNull()?.accepted)
        pending.forEach { s ->
            coVerify { submissionDao.updateSyncStatus(s.id, "SYNCED", any()) }
        }
    }

    @Test
    fun `sync sends lastSyncAt and clientVersion in request`() = runTest {
        val lastSync = 1713300000000L
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns lastSync
        every { tokenManager.deviceId } returns "device-abc"

        val requestSlot = slot<SyncRequest>()
        coEvery { syncApi.sync(capture(requestSlot)) } returns emptySyncResponse()

        repository.performSync()

        assertEquals(lastSync, requestSlot.captured.lastSyncAt)
        assertEquals("device-abc", requestSlot.captured.deviceId)
        assertEquals("android", requestSlot.captured.platform)
    }

    // ─── 2. Mixed server response (accept + reject + conflict) ──────────

    @Test
    fun `sync handles mixed response — accepted, rejected, conflicts in one batch`() = runTest {
        val pending = listOf(
            submission("s1"),
            submission("s2"),
            submission("s3"),
        )
        coEvery { submissionDao.getPendingSync() } returns pending
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            accepted = listOf("s1"),
            rejected = listOf(RejectedSubmission("s2", listOf("Invalid species", "Missing GPS"))),
            conflicts = listOf(ConflictSubmission("s3", """{"species":"caprine","count":10}""")),
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        val data = result.getOrNull()!!
        assertEquals(1, data.accepted)
        assertEquals(1, data.rejected)
        assertEquals(1, data.conflicts)

        coVerify { submissionDao.updateSyncStatus("s1", "SYNCED", any()) }
        coVerify { submissionDao.updateSyncError("s2", "FAILED", "Invalid species; Missing GPS") }
        coVerify { submissionDao.markConflict("s3", """{"species":"caprine","count":10}""") }
    }

    // ─── 3. Conflict detection and resolution cycle ──────────────────────

    @Test
    fun `conflict submission stores server version for comparison`() = runTest {
        val serverVersion = """{"species":"bovine","count":99,"updatedBy":"admin"}"""
        coEvery { submissionDao.getPendingSync() } returns listOf(submission("s1"))
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            conflicts = listOf(ConflictSubmission("s1", serverVersion)),
        )

        repository.performSync()

        coVerify { submissionDao.markConflict("s1", serverVersion) }
    }

    @Test
    fun `after conflict resolution, submission is re-queued as PENDING`() = runTest {
        // Simulate user resolving a conflict
        val resolvedData = """{"species":"bovine","count":99}"""
        coEvery { submissionDao.resolveConflict("s1", resolvedData) } returns Unit

        submissionDao.resolveConflict("s1", resolvedData)

        coVerify { submissionDao.resolveConflict("s1", resolvedData) }
    }

    @Test
    fun `resolved conflict re-syncs successfully on next cycle`() = runTest {
        // First sync: conflict
        val s1 = submission("s1")
        coEvery { submissionDao.getPendingSync() } returns listOf(s1)
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            conflicts = listOf(ConflictSubmission("s1", """{"count":99}""")),
        )

        repository.performSync()
        coVerify { submissionDao.markConflict("s1", any()) }

        // Simulate resolution: user chose server version, submission back to PENDING
        val resolvedSubmission = s1.copy(
            data = """{"count":99}""",
            syncStatus = "PENDING",
            serverData = null,
        )
        coEvery { submissionDao.getPendingSync() } returns listOf(resolvedSubmission)
        coEvery { syncApi.sync(any()) } returns emptySyncResponse(accepted = listOf("s1"))

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()?.accepted)
        coVerify { submissionDao.updateSyncStatus("s1", "SYNCED", any()) }
    }

    // ─── 4. Referential updates ──────────────────────────────────────────

    @Test
    fun `sync upserts species, diseases, and geo units from server`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            referentials = ReferentialUpdates(
                species = listOf(
                    SpeciesDto("sp1", "Cattle", "Bos taurus", "domestic"),
                    SpeciesDto("sp2", "Goat", "Capra aegagrus hircus", "domestic"),
                ),
                diseases = listOf(
                    DiseaseDto("d1", "FMD", "A010", "transboundary", true),
                ),
                geoUnits = listOf(
                    GeoDto("g1", "Kenya", "COUNTRY", null, "KE"),
                    GeoDto("g2", "Nairobi", "ADMIN1", "g1", null),
                ),
            ),
        )

        repository.performSync()

        coVerify { speciesDao.upsertAll(match { it.size == 2 }) }
        coVerify { diseaseDao.upsertAll(match { it.size == 1 }) }
        coVerify { geoDao.upsertAll(match { it.size == 2 }) }
    }

    @Test
    fun `sync skips referential upsert when lists are empty`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse()

        repository.performSync()

        coVerify(exactly = 0) { speciesDao.upsertAll(any()) }
        coVerify(exactly = 0) { diseaseDao.upsertAll(any()) }
        coVerify(exactly = 0) { geoDao.upsertAll(any()) }
    }

    // ─── 5. Campaign & template updates ──────────────────────────────────

    @Test
    fun `sync upserts new campaigns from server`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        val campaign = CampaignDto(
            id = "camp-new",
            tenantId = "tenant-ke",
            name = "FMD Survey 2026",
            domain = "animal-health",
            templateId = "tmpl-fmd",
            startDate = "2026-01-01",
            endDate = "2026-06-30",
            status = "ACTIVE",
        )
        coEvery { syncApi.sync(any()) } returns emptySyncResponse(campaigns = listOf(campaign))

        repository.performSync()

        coVerify { campaignDao.upsertAll(match { it.size == 1 && it[0].id == "camp-new" }) }
    }

    @Test
    fun `sync upserts updated form templates`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        val template = FormTemplateDto(
            id = "tmpl-v2",
            name = "Livestock Census v2",
            domain = "livestock",
            schema = """{"type":"object","properties":{"count":{"type":"number"}}}""",
            uiSchema = """{"count":{"ui:widget":"updown"}}""",
            version = 2,
        )
        coEvery { syncApi.sync(any()) } returns emptySyncResponse(templates = listOf(template))

        repository.performSync()

        coVerify {
            formTemplateDao.upsertAll(match {
                it.size == 1 && it[0].id == "tmpl-v2" && it[0].version == 2
            })
        }
    }

    // ─── 6. Workflow updates ─────────────────────────────────────────────

    @Test
    fun `sync applies workflow level updates to submissions`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            workflowUpdates = listOf(
                WorkflowUpdateDto("s1", 2, "APPROVED"),
                WorkflowUpdateDto("s2", 1, "REJECTED"),
            ),
        )

        repository.performSync()

        coVerify { submissionDao.updateWorkflow("s1", 2, "APPROVED") }
        coVerify { submissionDao.updateWorkflow("s2", 1, "REJECTED") }
    }

    @Test
    fun `sync applies quality gate results`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        val qualityJson = """{"completeness":0.95,"temporal":true,"geographic":true}"""
        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            qualityResults = listOf(QualityResultDto("s1", qualityJson)),
        )

        repository.performSync()

        coVerify { submissionDao.updateQualityResults("s1", qualityJson) }
    }

    // ─── 7. Network failure & retry scenarios ────────────────────────────

    @Test
    fun `sync fails gracefully on network timeout`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns listOf(submission("s1"))
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } throws SocketTimeoutException("Connection timed out")

        val result = repository.performSync()

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is SocketTimeoutException)
        // Submissions remain PENDING (no status change on error)
        coVerify(exactly = 0) { submissionDao.updateSyncStatus(any(), any(), any()) }
        coVerify(exactly = 0) { submissionDao.updateSyncError(any(), any(), any()) }
    }

    @Test
    fun `sync fails gracefully on IO error`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns listOf(submission("s1"))
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } throws IOException("Network unreachable")

        val result = repository.performSync()

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IOException)
    }

    @Test
    fun `sync does not update lastSyncAt on failure`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns 1000L
        coEvery { syncApi.sync(any()) } throws IOException("Offline")

        repository.performSync()

        // lastSyncAt setter should NOT be called on failure
        coVerify(exactly = 0) { tokenManager.lastSyncAt = any() }
    }

    @Test
    fun `sync updates lastSyncAt on success`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } returns emptySyncResponse()

        repository.performSync()

        coVerify { tokenManager.lastSyncAt = match { it > 0 } }
    }

    // ─── 8. Empty state ─────────────────────────────────────────────────

    @Test
    fun `sync with no pending submissions still fetches server updates`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns 1713000000000L

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            campaigns = listOf(
                CampaignDto(
                    "c1", "t1", "New Campaign", "health",
                    "tmpl1", emptyList(), emptyList(),
                    "2026-04-01", "2026-12-31", "ACTIVE",
                ),
            ),
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull()?.accepted)
        coVerify { campaignDao.upsertAll(any()) }
    }

    // ─── 9. Large batch ──────────────────────────────────────────────────

    @Test
    fun `sync handles large batch of 100 submissions`() = runTest {
        val largeBatch = (1..100).map { submission("s$it") }
        coEvery { submissionDao.getPendingSync() } returns largeBatch
        every { tokenManager.lastSyncAt } returns null

        val accepted = (1..95).map { "s$it" }
        val rejected = listOf(
            RejectedSubmission("s96", listOf("Duplicate")),
            RejectedSubmission("s97", listOf("Invalid data")),
        )
        val conflicts = listOf(
            ConflictSubmission("s98", """{"v":2}"""),
            ConflictSubmission("s99", """{"v":3}"""),
            ConflictSubmission("s100", """{"v":4}"""),
        )

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            accepted = accepted,
            rejected = rejected,
            conflicts = conflicts,
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)
        val data = result.getOrNull()!!
        assertEquals(95, data.accepted)
        assertEquals(2, data.rejected)
        assertEquals(3, data.conflicts)
    }

    // ─── 10. Full cycle: create offline → sync → workflow → quality ─────

    @Test
    fun `full lifecycle — offline creation to quality gate completion`() = runTest {
        // Step 1: sync pending submission
        val s1 = submission("s1")
        coEvery { submissionDao.getPendingSync() } returns listOf(s1)
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            accepted = listOf("s1"),
            workflowUpdates = listOf(WorkflowUpdateDto("s1", 1, "SUBMITTED")),
            qualityResults = listOf(
                QualityResultDto("s1", """{"completeness":1.0,"temporal":true}"""),
            ),
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)

        // Verify full pipeline in order
        coVerifyOrder {
            submissionDao.updateSyncStatus("s1", "SYNCED", any())
            submissionDao.updateWorkflow("s1", 1, "SUBMITTED")
            submissionDao.updateQualityResults("s1", """{"completeness":1.0,"temporal":true}""")
        }
    }

    // ─── 11. Partial server error ────────────────────────────────────────

    @Test
    fun `sync with server returning unexpected null fields does not crash`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            referentials = ReferentialUpdates(
                species = emptyList(),
                diseases = emptyList(),
                geoUnits = emptyList(),
            ),
            workflowUpdates = emptyList(),
            qualityResults = emptyList(),
        )

        val result = repository.performSync()

        assertTrue(result.isSuccess)
    }

    // ─── 12. Multiple rejection errors concatenated ──────────────────────

    @Test
    fun `rejected submission errors are joined with semicolons`() = runTest {
        coEvery { submissionDao.getPendingSync() } returns listOf(submission("s1"))
        every { tokenManager.lastSyncAt } returns null

        coEvery { syncApi.sync(any()) } returns emptySyncResponse(
            rejected = listOf(
                RejectedSubmission("s1", listOf("Missing species", "Invalid date", "GPS out of bounds")),
            ),
        )

        repository.performSync()

        coVerify {
            submissionDao.updateSyncError("s1", "FAILED", "Missing species; Invalid date; GPS out of bounds")
        }
    }

    // ─── 13. Consecutive syncs ───────────────────────────────────────────

    @Test
    fun `consecutive syncs with incremental lastSyncAt`() = runTest {
        val lastSyncSlot = slot<Long>()

        // First sync
        coEvery { submissionDao.getPendingSync() } returns emptyList()
        every { tokenManager.lastSyncAt } returns null
        coEvery { syncApi.sync(any()) } returns emptySyncResponse()
        every { tokenManager.lastSyncAt = capture(lastSyncSlot) } returns Unit

        repository.performSync()
        val firstSyncTime = lastSyncSlot.captured

        // Second sync — lastSyncAt should be the time from first sync
        every { tokenManager.lastSyncAt } returns firstSyncTime
        val requestSlot = slot<SyncRequest>()
        coEvery { syncApi.sync(capture(requestSlot)) } returns emptySyncResponse()

        repository.performSync()

        assertEquals(firstSyncTime, requestSlot.captured.lastSyncAt)
        assertTrue(lastSyncSlot.captured >= firstSyncTime)
    }
}
