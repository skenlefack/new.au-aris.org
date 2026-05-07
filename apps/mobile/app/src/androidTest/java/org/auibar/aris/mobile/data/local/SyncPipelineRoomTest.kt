package org.auibar.aris.mobile.data.local

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.PhotoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests verifying the full sync pipeline against a real
 * Room in-memory database. No mocks — exercises actual SQL queries.
 */
@RunWith(AndroidJUnit4::class)
class SyncPipelineRoomTest {

    private lateinit var db: ArisDatabase
    private lateinit var submissionDao: SubmissionDao
    private lateinit var campaignDao: CampaignDao
    private lateinit var formTemplateDao: FormTemplateDao
    private lateinit var speciesDao: SpeciesDao
    private lateinit var diseaseDao: DiseaseDao
    private lateinit var geoDao: GeoDao
    private lateinit var photoDao: PhotoDao

    @Before
    fun setup() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            ArisDatabase::class.java,
        ).allowMainThreadQueries().build()

        submissionDao = db.submissionDao()
        campaignDao = db.campaignDao()
        formTemplateDao = db.formTemplateDao()
        speciesDao = db.speciesDao()
        diseaseDao = db.diseaseDao()
        geoDao = db.geoDao()
        photoDao = db.photoDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private fun submission(
        id: String,
        campaignId: String = "camp-1",
        status: String = "PENDING",
    ) = SubmissionEntity(
        id = id,
        tenantId = "tenant-ke",
        campaignId = campaignId,
        templateId = "tmpl-1",
        data = """{"species":"bovine","count":42}""",
        gpsLat = -1.286,
        gpsLng = 36.817,
        gpsAccuracy = 5.0f,
        offlineCreatedAt = System.currentTimeMillis(),
        syncedAt = null,
        syncStatus = status,
        serverErrors = null,
        domain = "animal-health",
    )

    private fun campaign(id: String) = CampaignEntity(
        id = id,
        tenantId = "tenant-ke",
        name = "FMD Survey 2026",
        domain = "animal-health",
        templateId = "tmpl-1",
        startDate = 1704067200000,
        endDate = 1735689600000,
        status = "ACTIVE",
        syncedAt = System.currentTimeMillis(),
    )

    // ─── 1. Submission CRUD ──────────────────────────────────────────

    @Test
    fun insertAndRetrieveSubmission() = runTest {
        val s = submission("s1")
        submissionDao.insert(s)

        val retrieved = submissionDao.getById("s1")
        assertNotNull(retrieved)
        assertEquals("s1", retrieved!!.id)
        assertEquals("PENDING", retrieved.syncStatus)
        assertEquals("animal-health", retrieved.domain)
    }

    @Test
    fun getPendingSyncReturnsOnlyPending() = runTest {
        submissionDao.insert(submission("s1", status = "PENDING"))
        submissionDao.insert(submission("s2", status = "SYNCED"))
        submissionDao.insert(submission("s3", status = "PENDING"))
        submissionDao.insert(submission("s4", status = "FAILED"))

        val pending = submissionDao.getPendingSync()
        assertEquals(2, pending.size)
        assertTrue(pending.all { it.syncStatus == "PENDING" })
    }

    // ─── 2. Sync status transitions ─────────────────────────────────

    @Test
    fun markAcceptedAsSynced() = runTest {
        submissionDao.insert(submission("s1"))
        val now = System.currentTimeMillis()

        submissionDao.updateSyncStatus("s1", "SYNCED", now)

        val updated = submissionDao.getById("s1")!!
        assertEquals("SYNCED", updated.syncStatus)
        assertEquals(now, updated.syncedAt)
    }

    @Test
    fun markRejectedWithErrors() = runTest {
        submissionDao.insert(submission("s1"))

        submissionDao.updateSyncError("s1", "FAILED", "Invalid species; Missing GPS")

        val updated = submissionDao.getById("s1")!!
        assertEquals("FAILED", updated.syncStatus)
        assertEquals("Invalid species; Missing GPS", updated.serverErrors)
    }

    // ─── 3. Conflict detection & resolution ─────────────────────────

    @Test
    fun markConflictStoresServerData() = runTest {
        submissionDao.insert(submission("s1"))
        val serverVersion = """{"species":"caprine","count":99}"""

        submissionDao.markConflict("s1", serverVersion)

        val conflicted = submissionDao.getById("s1")!!
        assertEquals("CONFLICT", conflicted.syncStatus)
        assertEquals(serverVersion, conflicted.serverData)
    }

    @Test
    fun resolveConflictResetsToPending() = runTest {
        submissionDao.insert(submission("s1"))
        submissionDao.markConflict("s1", """{"v":"server"}""")

        submissionDao.resolveConflict("s1", """{"species":"bovine","count":99}""")

        val resolved = submissionDao.getById("s1")!!
        assertEquals("PENDING", resolved.syncStatus)
        assertNull(resolved.serverData)
        assertNull(resolved.serverErrors)
        assertEquals("""{"species":"bovine","count":99}""", resolved.data)
    }

    @Test
    fun getConflictsReturnsOnlyConflicts() = runTest {
        submissionDao.insert(submission("s1", status = "PENDING"))
        submissionDao.insert(submission("s2", status = "CONFLICT"))
        submissionDao.insert(submission("s3", status = "CONFLICT"))

        val conflicts = submissionDao.getConflicts().first()
        assertEquals(2, conflicts.size)
        assertTrue(conflicts.all { it.syncStatus == "CONFLICT" })
    }

    // ─── 4. Workflow updates ─────────────────────────────────────────

    @Test
    fun updateWorkflowLevelAndStatus() = runTest {
        submissionDao.insert(submission("s1"))

        submissionDao.updateWorkflow("s1", 2, "APPROVED")

        val updated = submissionDao.getById("s1")!!
        assertEquals(2, updated.workflowLevel)
        assertEquals("APPROVED", updated.workflowStatus)
    }

    @Test
    fun updateQualityGateResults() = runTest {
        submissionDao.insert(submission("s1"))
        val results = """{"completeness":0.95,"temporal":true}"""

        submissionDao.updateQualityResults("s1", results)

        val updated = submissionDao.getById("s1")!!
        assertEquals(results, updated.qualityGateResults)
    }

    // ─── 5. Campaign upsert ──────────────────────────────────────────

    @Test
    fun upsertCampaignInsertsThenUpdates() = runTest {
        val c = campaign("c1")
        campaignDao.upsertAll(listOf(c))

        val retrieved = campaignDao.getById("c1")
        assertNotNull(retrieved)
        assertEquals("FMD Survey 2026", retrieved!!.name)

        // Update name
        campaignDao.upsertAll(listOf(c.copy(name = "FMD Survey 2026 v2")))
        val updated = campaignDao.getById("c1")!!
        assertEquals("FMD Survey 2026 v2", updated.name)
    }

    // ─── 6. Referential upserts ──────────────────────────────────────

    @Test
    fun upsertSpecies() = runTest {
        val now = System.currentTimeMillis()
        speciesDao.upsertAll(listOf(
            SpeciesEntity("sp1", "Cattle", "Bos taurus", "domestic", now),
            SpeciesEntity("sp2", "Goat", "Capra hircus", "domestic", now),
        ))

        val all = speciesDao.getAll()
        assertEquals(2, all.size)
    }

    @Test
    fun upsertDiseases() = runTest {
        val now = System.currentTimeMillis()
        diseaseDao.upsertAll(listOf(
            DiseaseEntity("d1", "FMD", "A010", "transboundary", true, now),
        ))

        val all = diseaseDao.getAll()
        assertEquals(1, all.size)
        assertTrue(all[0].isNotifiable)
    }

    @Test
    fun upsertGeoUnits() = runTest {
        val now = System.currentTimeMillis()
        geoDao.upsertAll(listOf(
            GeoEntity("g1", "Kenya", "COUNTRY", null, "KE", now),
            GeoEntity("g2", "Nairobi", "ADMIN1", "g1", null, now),
        ))

        val all = geoDao.getAll()
        assertEquals(2, all.size)
    }

    // ─── 7. Form template upsert ─────────────────────────────────────

    @Test
    fun upsertFormTemplate() = runTest {
        formTemplateDao.upsertAll(listOf(
            FormTemplateEntity(
                id = "tmpl-1",
                name = "Livestock Census",
                domain = "livestock",
                schema = """{"type":"object"}""",
                uiSchema = "{}",
                version = 1,
                syncedAt = System.currentTimeMillis(),
            ),
        ))

        val tmpl = formTemplateDao.getById("tmpl-1")
        assertNotNull(tmpl)
        assertEquals("Livestock Census", tmpl!!.name)
        assertEquals(1, tmpl.version)
    }

    // ─── 8. Photo upload tracking ────────────────────────────────────

    @Test
    fun photoUploadLifecycle() = runTest {
        val photo = PhotoEntity(
            id = "p1",
            submissionId = "s1",
            filePath = "/data/photos/p1.jpg",
            thumbnailPath = null,
            originalSizeBytes = 2_000_000,
            compressedSizeBytes = 500_000,
            gpsLat = -1.286,
            gpsLng = 36.817,
            capturedAt = System.currentTimeMillis(),
            uploadStatus = "PENDING",
            serverUrl = null,
            errorMessage = null,
        )
        photoDao.insert(photo)

        // Pending upload query finds it
        val pending = photoDao.getPendingUpload()
        assertEquals(1, pending.size)

        // Upload succeeds
        photoDao.updateUploadStatus("p1", "UPLOADED", "https://cdn/p1.jpg")
        val uploaded = photoDao.getById("p1")!!
        assertEquals("UPLOADED", uploaded.uploadStatus)
        assertEquals("https://cdn/p1.jpg", uploaded.serverUrl)

        // Cleanup
        val deleted = photoDao.deleteUploaded()
        assertEquals(1, deleted)
    }

    // ─── 9. Submission counts ────────────────────────────────────────

    @Test
    fun countByStatusAndDomain() = runTest {
        submissionDao.insert(submission("s1", status = "PENDING"))
        submissionDao.insert(submission("s2", status = "SYNCED"))
        submissionDao.insert(submission("s3", status = "PENDING"))
        submissionDao.insert(submission("s4", status = "FAILED"))

        assertEquals(2, submissionDao.getCountByStatus("PENDING"))
        assertEquals(1, submissionDao.getCountByStatus("SYNCED"))
        assertEquals(1, submissionDao.getCountByStatus("FAILED"))
        assertEquals(4, submissionDao.getTotalCount())

        val byDomain = submissionDao.getCountByDomain()
        assertEquals(1, byDomain.size)
        assertEquals("animal-health", byDomain[0].domain)
        assertEquals(4, byDomain[0].cnt)
    }

    // ─── 10. Delete synced submissions ───────────────────────────────

    @Test
    fun deleteSyncedKeepsOthers() = runTest {
        submissionDao.insert(submission("s1", status = "SYNCED"))
        submissionDao.insert(submission("s2", status = "SYNCED"))
        submissionDao.insert(submission("s3", status = "PENDING"))

        val deleted = submissionDao.deleteSynced()
        assertEquals(2, deleted)
        assertEquals(1, submissionDao.getTotalCount())
        assertNotNull(submissionDao.getById("s3"))
    }

    // ─── 11. Full sync pipeline simulation ───────────────────────────

    @Test
    fun fullSyncPipelineEndToEnd() = runTest {
        // Step 1: Offline data entry
        submissionDao.insert(submission("s1"))
        submissionDao.insert(submission("s2"))
        submissionDao.insert(submission("s3"))
        assertEquals(3, submissionDao.getPendingSync().size)

        // Step 2: Simulate server response — s1 accepted, s2 rejected, s3 conflict
        val now = System.currentTimeMillis()
        submissionDao.updateSyncStatus("s1", "SYNCED", now)
        submissionDao.updateSyncError("s2", "FAILED", "Invalid data")
        submissionDao.markConflict("s3", """{"v":"server"}""")

        // Verify states
        assertEquals("SYNCED", submissionDao.getById("s1")!!.syncStatus)
        assertEquals("FAILED", submissionDao.getById("s2")!!.syncStatus)
        assertEquals("CONFLICT", submissionDao.getById("s3")!!.syncStatus)
        assertEquals(0, submissionDao.getPendingSync().size)

        // Step 3: Resolve conflict → back to PENDING
        submissionDao.resolveConflict("s3", """{"merged":"data"}""")
        assertEquals(1, submissionDao.getPendingSync().size)

        // Step 4: Re-sync resolved → accepted
        submissionDao.updateSyncStatus("s3", "SYNCED", now)

        // Step 5: Workflow progression
        submissionDao.updateWorkflow("s1", 1, "SUBMITTED")
        submissionDao.updateWorkflow("s1", 2, "APPROVED")
        submissionDao.updateQualityResults("s1", """{"completeness":1.0}""")

        val final1 = submissionDao.getById("s1")!!
        assertEquals(2, final1.workflowLevel)
        assertEquals("APPROVED", final1.workflowStatus)
        assertEquals("""{"completeness":1.0}""", final1.qualityGateResults)

        // Step 6: Referential updates alongside sync
        speciesDao.upsertAll(listOf(
            SpeciesEntity("sp1", "Cattle", "Bos taurus", "domestic", now),
        ))
        geoDao.upsertAll(listOf(
            GeoEntity("g1", "Kenya", "COUNTRY", null, "KE", now),
        ))

        assertEquals(1, speciesDao.getAll().size)
        assertEquals(1, geoDao.getAll().size)
    }
}
