package org.auibar.aris.mobile.data.local.migrations

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.auibar.aris.mobile.data.local.ArisDatabase
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(AndroidJUnit4::class)
class Migration9To10Test {

    private val testDb = "migration-test"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        ArisDatabase::class.java.canonicalName!!,
        FrameworkSQLiteOpenHelperFactory(),
    )

    @Test
    fun migrate_9_to_10_preserves_existing_data() {
        // 1. Create a v9 DB with test data
        helper.createDatabase(testDb, 9).apply {
            execSQL("""
                INSERT INTO campaigns (id, tenantId, name, domain, templateId, startDate, endDate, status, totalSubmissions, validatedSubmissions, rejectedSubmissions)
                VALUES ('c1', 't1', 'Campaign Test', 'ANIMAL_HEALTH', 'tpl1', 0, 100, 'ACTIVE', 0, 0, 0)
            """.trimIndent())
            execSQL("""
                INSERT INTO form_templates (id, name, domain, schema, uiSchema, version, syncedAt)
                VALUES ('tpl1', 'Template Test', 'ANIMAL_HEALTH', '{}', '{}', 1, 0)
            """.trimIndent())
            execSQL("""
                INSERT INTO photos (id, submissionId, filePath, thumbnailPath, originalSizeBytes, compressedSizeBytes, gpsLat, gpsLng, capturedAt, uploadStatus, serverUrl, errorMessage)
                VALUES ('p1', 's1', '/path/photo.jpg', NULL, 1024, 512, NULL, NULL, 1000, 'PENDING', NULL, NULL)
            """.trimIndent())
            close()
        }

        // 2. Run migration v9→v10
        val db = helper.runMigrationsAndValidate(testDb, 10, true, MIGRATION_9_10)

        // 3. Verify legacy data is preserved
        db.query("SELECT id, domain FROM campaigns WHERE id = 'c1'").use { cursor ->
            assertTrue(cursor.moveToFirst(), "Campaign c1 should exist")
            assertEquals("c1", cursor.getString(0))
            assertEquals("ANIMAL_HEALTH", cursor.getString(1))
        }

        db.query("SELECT id, domain FROM form_templates WHERE id = 'tpl1'").use { cursor ->
            assertTrue(cursor.moveToFirst(), "Template tpl1 should exist")
            assertEquals("ANIMAL_HEALTH", cursor.getString(1))
        }

        // 4. Verify photo retryCount column added with default 0
        db.query("SELECT id, retryCount FROM photos WHERE id = 'p1'").use { cursor ->
            assertTrue(cursor.moveToFirst(), "Photo p1 should exist")
            assertEquals(0, cursor.getInt(1), "retryCount should default to 0")
        }

        // 5. Verify all 9 new tables exist and are empty
        val newTables = listOf(
            "campaign_targets", "form_template_targets",
            "indicators", "indicator_values",
            "dashboards", "dashboard_widgets",
            "reports", "flash_alerts",
            "user_dashboard_preferences",
        )
        newTables.forEach { table ->
            db.query("SELECT COUNT(*) FROM $table").use { cursor ->
                assertTrue(cursor.moveToFirst(), "Table $table should exist")
                assertEquals(0, cursor.getInt(0), "Table $table should be empty after migration")
            }
        }

        // 6. Verify critical indices exist
        db.query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='indicators'").use { cursor ->
            val indices = mutableListOf<String>()
            while (cursor.moveToNext()) indices.add(cursor.getString(0))
            assertTrue(indices.any { it.contains("code") }, "Unique index on indicators.code should exist")
            assertTrue(indices.any { it.contains("domainCode") }, "Index on indicators.domainCode should exist")
        }

        db.close()
    }

    @Test
    fun migrate_9_to_10_can_insert_into_new_tables() {
        helper.createDatabase(testDb, 9).apply {
            execSQL("""
                INSERT INTO campaigns (id, tenantId, name, domain, templateId, startDate, endDate, status, totalSubmissions, validatedSubmissions, rejectedSubmissions)
                VALUES ('c1', 't1', 'Test', 'ANIMAL_HEALTH', 'tpl1', 0, 100, 'ACTIVE', 0, 0, 0)
            """.trimIndent())
            close()
        }

        val db = helper.runMigrationsAndValidate(testDb, 10, true, MIGRATION_9_10)

        // Insert campaign target
        db.execSQL("""
            INSERT INTO campaign_targets (id, campaignId, domainCode, subDomainCode, isPrimary, syncedAt)
            VALUES ('t1', 'c1', 'ANIMAL_HEALTH', 'SURVEILLANCE', 1, 1000)
        """.trimIndent())
        db.query("SELECT domainCode, subDomainCode, isPrimary FROM campaign_targets WHERE id = 't1'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("ANIMAL_HEALTH", cursor.getString(0))
            assertEquals("SURVEILLANCE", cursor.getString(1))
            assertEquals(1, cursor.getInt(2))
        }

        // Insert indicator
        db.execSQL("""
            INSERT INTO indicators (id, code, nameFr, nameEn, typeCode, unit, measurementMode, syncedAt)
            VALUES ('i1', 'IND-001', 'Test FR', 'Test EN', 'KPI', 'heads', 'MANUAL_ENTRY', 1000)
        """.trimIndent())
        db.query("SELECT code, nameFr FROM indicators WHERE id = 'i1'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("IND-001", cursor.getString(0))
            assertEquals("Test FR", cursor.getString(1))
        }

        // Insert dashboard + widget
        db.execSQL("""
            INSERT INTO dashboards (id, ownership, scope, titleFr, titleEn, syncedAt)
            VALUES ('d1', 'SYSTEM', 'CONTINENTAL', 'Dashboard Test', 'Dashboard Test', 1000)
        """.trimIndent())
        db.execSQL("""
            INSERT INTO dashboard_widgets (id, dashboardId, type, dataSource, titleFr, titleEn, syncedAt)
            VALUES ('w1', 'd1', 'KPI_CARD', 'INDICATOR', 'Widget FR', 'Widget EN', 1000)
        """.trimIndent())
        db.query("SELECT type FROM dashboard_widgets WHERE dashboardId = 'd1'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("KPI_CARD", cursor.getString(0))
        }

        // Insert report
        db.execSQL("""
            INSERT INTO reports (id, templateCode, type, status, titleFr, titleEn, periodStart, periodEnd, scope, syncedAt)
            VALUES ('r1', 'RPT-001', 'PERIODIC', 'PUBLISHED', 'Rapport', 'Report', 1000, 2000, 'CONTINENTAL', 1000)
        """.trimIndent())
        db.query("SELECT pdfDownloadStatus FROM reports WHERE id = 'r1'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("NOT_DOWNLOADED", cursor.getString(0))
        }

        // Insert flash alert
        db.execSQL("""
            INSERT INTO flash_alerts (id, alertCode, severity, sourceType, titleFr, titleEn, detectedAt, status, syncedAt)
            VALUES ('fa1', 'ALERT-001', 'HIGH', 'INDICATOR', 'Alerte', 'Alert', 1000, 'ACTIVE', 1000)
        """.trimIndent())
        db.query("SELECT isRead FROM flash_alerts WHERE id = 'fa1'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(0, cursor.getInt(0))
        }

        // Verify FK cascade: deleting campaign deletes its targets
        db.execSQL("DELETE FROM campaigns WHERE id = 'c1'")
        db.query("SELECT COUNT(*) FROM campaign_targets WHERE campaignId = 'c1'").use { cursor ->
            cursor.moveToFirst()
            assertEquals(0, cursor.getInt(0), "Cascade delete should remove campaign targets")
        }

        db.close()
    }

    @Test
    fun migrate_9_to_10_unique_index_on_indicator_code() {
        helper.createDatabase(testDb, 9).close()
        val db = helper.runMigrationsAndValidate(testDb, 10, true, MIGRATION_9_10)

        db.execSQL("""
            INSERT INTO indicators (id, code, nameFr, nameEn, typeCode, unit, measurementMode, syncedAt)
            VALUES ('i1', 'UNIQUE-CODE', 'Test', 'Test', 'KPI', 'heads', 'MANUAL_ENTRY', 1000)
        """.trimIndent())

        // Second insert with same code should fail (unique constraint)
        var threw = false
        try {
            db.execSQL("""
                INSERT INTO indicators (id, code, nameFr, nameEn, typeCode, unit, measurementMode, syncedAt)
                VALUES ('i2', 'UNIQUE-CODE', 'Test2', 'Test2', 'KPI', 'heads', 'MANUAL_ENTRY', 1000)
            """.trimIndent())
        } catch (_: Exception) {
            threw = true
        }
        assertTrue(threw, "Duplicate indicator code should violate unique constraint")

        db.close()
    }
}
