package org.auibar.aris.mobile.data.local.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration v12 → v13 : Generic ref_data_cache table for offline form select options.
 */
val MIGRATION_12_13 = object : Migration(12, 13) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `ref_data_cache` (
                `type` TEXT NOT NULL,
                `itemId` TEXT NOT NULL,
                `label` TEXT NOT NULL,
                `parentId` TEXT DEFAULT NULL,
                `sortOrder` INTEGER NOT NULL DEFAULT 0,
                `cachedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`type`, `itemId`)
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_ref_data_cache_type ON ref_data_cache(type)")
    }
}
