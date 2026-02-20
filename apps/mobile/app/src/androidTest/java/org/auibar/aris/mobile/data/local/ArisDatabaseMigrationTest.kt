package org.auibar.aris.mobile.data.local

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ArisDatabaseMigrationTest {

    private val testDbName = "aris_migration_test"

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        ArisDatabase::class.java,
    )

    @Test
    fun createDatabase_version4() {
        // Create the database at the latest version
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(context, ArisDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        // Verify all DAOs are accessible
        assertNotNull(db.campaignDao())
        assertNotNull(db.submissionDao())
        assertNotNull(db.formTemplateDao())
        assertNotNull(db.speciesDao())
        assertNotNull(db.diseaseDao())
        assertNotNull(db.geoDao())
        assertNotNull(db.notificationDao())
        assertNotNull(db.photoDao())
        assertNotNull(db.gpsTrackDao())

        db.close()
    }

    @Test
    fun insertAndReadCampaign() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(context, ArisDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        val campaign = org.auibar.aris.mobile.data.local.entity.CampaignEntity(
            id = "test-campaign-1",
            tenantId = "ke",
            name = "Livestock Census Kenya 2026",
            domain = "livestock",
            templateId = "tmpl-livestock-census",
            startDate = System.currentTimeMillis(),
            endDate = System.currentTimeMillis() + 86400000L,
            status = "ACTIVE",
            syncedAt = System.currentTimeMillis(),
        )

        // Use runBlocking for suspend DAO methods
        kotlinx.coroutines.runBlocking {
            db.campaignDao().upsertAll(listOf(campaign))
            val retrieved = db.campaignDao().getById("test-campaign-1")
            assertNotNull(retrieved)
            assertEquals("Livestock Census Kenya 2026", retrieved?.name)
            assertEquals("ACTIVE", retrieved?.status)
            assertEquals("livestock", retrieved?.domain)
        }

        db.close()
    }

    @Test
    fun insertAndReadSubmission() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(context, ArisDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        val submission = org.auibar.aris.mobile.data.local.entity.SubmissionEntity(
            id = "sub-1",
            tenantId = "ke",
            campaignId = "campaign-1",
            templateId = "template-1",
            data = """{"species":"cattle","count":500}""",
            gpsLat = -1.2921,
            gpsLng = 36.8219,
            gpsAccuracy = 5.0f,
            offlineCreatedAt = System.currentTimeMillis(),
            syncedAt = null,
            syncStatus = "PENDING",
            serverErrors = null,
        )

        kotlinx.coroutines.runBlocking {
            db.submissionDao().insert(submission)
            val pending = db.submissionDao().getPendingSync()
            assertTrue(pending.isNotEmpty())
            assertEquals("sub-1", pending.first().id)
            assertEquals("PENDING", pending.first().syncStatus)
        }

        db.close()
    }

    @Test
    fun insertMasterDataAndQuery() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(context, ArisDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        val now = System.currentTimeMillis()

        kotlinx.coroutines.runBlocking {
            // Insert species
            db.speciesDao().upsertAll(listOf(
                org.auibar.aris.mobile.data.local.entity.SpeciesEntity(
                    id = "sp-1", commonName = "Cattle", scientificName = "Bos taurus",
                    category = "DOMESTIC", syncedAt = now,
                ),
                org.auibar.aris.mobile.data.local.entity.SpeciesEntity(
                    id = "sp-2", commonName = "Goat", scientificName = "Capra aegagrus hircus",
                    category = "DOMESTIC", syncedAt = now,
                ),
            ))

            val species = db.speciesDao().getAll()
            assertEquals(2, species.size)
            assertEquals("Cattle", species.first().commonName) // sorted by commonName ASC

            val domestic = db.speciesDao().getByCategory("DOMESTIC")
            assertEquals(2, domestic.size)
        }

        db.close()
    }

    @Test
    fun submissionSyncStatusUpdate() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(context, ArisDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        kotlinx.coroutines.runBlocking {
            val submission = org.auibar.aris.mobile.data.local.entity.SubmissionEntity(
                id = "sub-sync-test",
                tenantId = "ke",
                campaignId = "c-1",
                templateId = "t-1",
                data = "{}",
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
                offlineCreatedAt = System.currentTimeMillis(),
                syncedAt = null,
                syncStatus = "PENDING",
                serverErrors = null,
            )
            db.submissionDao().insert(submission)

            // Update sync status
            val now = System.currentTimeMillis()
            db.submissionDao().updateSyncStatus("sub-sync-test", "SYNCED", now)

            val pending = db.submissionDao().getPendingSync()
            assertTrue(pending.isEmpty())
        }

        db.close()
    }
}
