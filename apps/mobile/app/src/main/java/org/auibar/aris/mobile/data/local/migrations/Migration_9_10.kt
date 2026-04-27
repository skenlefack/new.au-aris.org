package org.auibar.aris.mobile.data.local.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration v9 → v10 : Chantier A (multi-target) + Chantier C (indicators) +
 * Chantier B (dashboards) + Chantier D (reports/flash) + photo retry cap.
 *
 * Strategy: additive-only changes — no DROP, no ALTER COLUMN.
 * Legacy `domain` columns on campaigns/form_templates remain for backward compat.
 */
val MIGRATION_9_10 = object : Migration(9, 10) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // --- Chantier A: Multi-target ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `campaign_targets` (
                `id` TEXT NOT NULL,
                `campaignId` TEXT NOT NULL,
                `domainCode` TEXT NOT NULL,
                `subDomainCode` TEXT,
                `isPrimary` INTEGER NOT NULL DEFAULT 0,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`),
                FOREIGN KEY(`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_campaign_targets_campaignId` ON `campaign_targets`(`campaignId`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_campaign_targets_domainCode` ON `campaign_targets`(`domainCode`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_campaign_targets_subDomainCode` ON `campaign_targets`(`subDomainCode`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `form_template_targets` (
                `id` TEXT NOT NULL,
                `templateId` TEXT NOT NULL,
                `domainCode` TEXT NOT NULL,
                `subDomainCode` TEXT,
                `isPrimary` INTEGER NOT NULL DEFAULT 0,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`),
                FOREIGN KEY(`templateId`) REFERENCES `form_templates`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_form_template_targets_templateId` ON `form_template_targets`(`templateId`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_form_template_targets_domainCode` ON `form_template_targets`(`domainCode`)")

        // --- Chantier C: Indicators ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `indicators` (
                `id` TEXT NOT NULL,
                `code` TEXT NOT NULL,
                `nameFr` TEXT NOT NULL,
                `nameEn` TEXT NOT NULL,
                `nameAr` TEXT,
                `namePt` TEXT,
                `descriptionFr` TEXT,
                `descriptionEn` TEXT,
                `typeCode` TEXT NOT NULL,
                `domainCode` TEXT,
                `subDomainCode` TEXT,
                `unit` TEXT NOT NULL,
                `decimalPlaces` INTEGER NOT NULL DEFAULT 2,
                `targetValue` REAL,
                `betterIsHigher` INTEGER NOT NULL DEFAULT 1,
                `measurementMode` TEXT NOT NULL,
                `formulaExpression` TEXT,
                `lastValue` REAL,
                `lastValueAt` INTEGER,
                `previousValue` REAL,
                `trend` TEXT,
                `active` INTEGER NOT NULL DEFAULT 1,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`)
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `idx_indicators_code` ON `indicators`(`code`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_indicators_domainCode` ON `indicators`(`domainCode`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_indicators_subDomainCode` ON `indicators`(`subDomainCode`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_indicators_typeCode` ON `indicators`(`typeCode`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `indicator_values` (
                `id` TEXT NOT NULL,
                `indicatorId` TEXT NOT NULL,
                `year` INTEGER NOT NULL,
                `month` INTEGER,
                `quarter` INTEGER,
                `countryCode` TEXT,
                `recCode` TEXT,
                `isContinental` INTEGER NOT NULL DEFAULT 0,
                `value` REAL NOT NULL,
                `source` TEXT,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`),
                FOREIGN KEY(`indicatorId`) REFERENCES `indicators`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_indicator_values_indicatorId` ON `indicator_values`(`indicatorId`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_indicator_values_year` ON `indicator_values`(`year`)")

        // --- Chantier B: Dashboards ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `dashboards` (
                `id` TEXT NOT NULL,
                `ownership` TEXT NOT NULL,
                `scope` TEXT NOT NULL,
                `domainCode` TEXT,
                `subDomainCode` TEXT,
                `valueChainCode` TEXT,
                `recCode` TEXT,
                `countryCode` TEXT,
                `titleFr` TEXT NOT NULL,
                `titleEn` TEXT NOT NULL,
                `titleAr` TEXT,
                `titlePt` TEXT,
                `description` TEXT,
                `gridColumns` INTEGER NOT NULL DEFAULT 12,
                `rowHeight` INTEGER NOT NULL DEFAULT 80,
                `ownerUserId` TEXT,
                `isDefault` INTEGER NOT NULL DEFAULT 0,
                `cachedSnapshot` TEXT,
                `cachedSnapshotAt` INTEGER,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`)
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_dashboards_scope` ON `dashboards`(`scope`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_dashboards_domainCode` ON `dashboards`(`domainCode`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_dashboards_ownerUserId` ON `dashboards`(`ownerUserId`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `dashboard_widgets` (
                `id` TEXT NOT NULL,
                `dashboardId` TEXT NOT NULL,
                `type` TEXT NOT NULL,
                `dataSource` TEXT NOT NULL,
                `gridX` INTEGER NOT NULL DEFAULT 0,
                `gridY` INTEGER NOT NULL DEFAULT 0,
                `gridW` INTEGER NOT NULL DEFAULT 12,
                `gridH` INTEGER NOT NULL DEFAULT 2,
                `titleFr` TEXT NOT NULL,
                `titleEn` TEXT NOT NULL,
                `configJson` TEXT NOT NULL DEFAULT '{}',
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`),
                FOREIGN KEY(`dashboardId`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_dashboard_widgets_dashboardId` ON `dashboard_widgets`(`dashboardId`)")

        // --- Chantier D: Reports ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `reports` (
                `id` TEXT NOT NULL,
                `templateCode` TEXT NOT NULL,
                `type` TEXT NOT NULL,
                `status` TEXT NOT NULL,
                `titleFr` TEXT NOT NULL,
                `titleEn` TEXT NOT NULL,
                `themeFr` TEXT,
                `themeEn` TEXT,
                `periodStart` INTEGER NOT NULL,
                `periodEnd` INTEGER NOT NULL,
                `referenceYear` INTEGER,
                `scope` TEXT NOT NULL,
                `domainCode` TEXT,
                `subDomainCode` TEXT,
                `countryCode` TEXT,
                `recCode` TEXT,
                `pdfLocalPath` TEXT,
                `pdfRemoteUrl` TEXT,
                `pdfSizeBytes` INTEGER,
                `pdfDownloadStatus` TEXT NOT NULL DEFAULT 'NOT_DOWNLOADED',
                `publishedAt` INTEGER,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`)
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_reports_status` ON `reports`(`status`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_reports_domainCode` ON `reports`(`domainCode`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_reports_publishedAt` ON `reports`(`publishedAt`)")

        // --- Chantier D: Flash Alerts ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `flash_alerts` (
                `id` TEXT NOT NULL,
                `alertCode` TEXT NOT NULL,
                `severity` TEXT NOT NULL,
                `sourceType` TEXT NOT NULL,
                `sourceId` TEXT,
                `countryCode` TEXT,
                `recCode` TEXT,
                `domainCode` TEXT,
                `subDomainCode` TEXT,
                `titleFr` TEXT NOT NULL,
                `titleEn` TEXT NOT NULL,
                `detectedAt` INTEGER NOT NULL,
                `triggerDataJson` TEXT,
                `status` TEXT NOT NULL,
                `relatedReportId` TEXT,
                `isRead` INTEGER NOT NULL DEFAULT 0,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`)
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_flash_alerts_severity` ON `flash_alerts`(`severity`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_flash_alerts_detectedAt` ON `flash_alerts`(`detectedAt`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `idx_flash_alerts_isRead` ON `flash_alerts`(`isRead`)")

        // --- Dashboard preferences ---

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `user_dashboard_preferences` (
                `id` TEXT NOT NULL,
                `userId` TEXT NOT NULL,
                `scope` TEXT NOT NULL,
                `domainCode` TEXT,
                `subDomainCode` TEXT,
                `valueChainCode` TEXT,
                `dashboardId` TEXT NOT NULL,
                `syncedAt` INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(`id`)
            )
        """.trimIndent())
        db.execSQL("""
            CREATE UNIQUE INDEX IF NOT EXISTS `idx_user_dashboard_pref_unique`
            ON `user_dashboard_preferences`(`userId`, `scope`, `domainCode`, `subDomainCode`, `valueChainCode`)
        """.trimIndent())

        // --- Photo retry cap (Lot 8 prep) ---

        db.execSQL("ALTER TABLE `photos` ADD COLUMN `retryCount` INTEGER NOT NULL DEFAULT 0")
    }
}
