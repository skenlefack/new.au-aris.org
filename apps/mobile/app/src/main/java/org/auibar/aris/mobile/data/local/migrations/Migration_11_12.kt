package org.auibar.aris.mobile.data.local.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration v11 → v12 : Add campaignId column to dashboards for campaign-linked dashboards.
 */
val MIGRATION_11_12 = object : Migration(11, 12) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE dashboards ADD COLUMN campaignId TEXT DEFAULT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_dashboards_campaignId ON dashboards(campaignId)")
    }
}
