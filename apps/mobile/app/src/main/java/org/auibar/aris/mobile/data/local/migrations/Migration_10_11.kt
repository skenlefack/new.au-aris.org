package org.auibar.aris.mobile.data.local.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration v10 → v11 : KPI snapshot cache table for offline dashboard KPIs.
 */
val MIGRATION_10_11 = object : Migration(10, 11) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `kpi_snapshots` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `kpisJson` TEXT NOT NULL DEFAULT '[]',
                `chartsJson` TEXT,
                `fetchedAt` INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
    }
}
