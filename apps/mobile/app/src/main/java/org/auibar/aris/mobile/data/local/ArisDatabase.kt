package org.auibar.aris.mobile.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.CampaignTargetDao
import org.auibar.aris.mobile.data.local.dao.DashboardDao
import org.auibar.aris.mobile.data.local.dao.DashboardWidgetDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FlashAlertDao
import org.auibar.aris.mobile.data.local.dao.KpiSnapshotDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateTargetDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.dao.IndicatorDao
import org.auibar.aris.mobile.data.local.dao.IndicatorValueDao
import org.auibar.aris.mobile.data.local.dao.KnowledgeDao
import org.auibar.aris.mobile.data.local.dao.MessageDao
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.RefDataCacheDao
import org.auibar.aris.mobile.data.local.dao.ReportDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.dao.UserDashboardPreferenceDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.CampaignTargetEntity
import org.auibar.aris.mobile.data.local.entity.DashboardEntity
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateTargetEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.GpsTrackEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorValueEntity
import org.auibar.aris.mobile.data.local.entity.KnowledgeCategoryEntity
import org.auibar.aris.mobile.data.local.entity.KpiSnapshotEntity
import org.auibar.aris.mobile.data.local.entity.KnowledgePublicationEntity
import org.auibar.aris.mobile.data.local.entity.MessageEntity
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.local.entity.PhotoEntity
import org.auibar.aris.mobile.data.local.entity.RefDataCacheEntity
import org.auibar.aris.mobile.data.local.entity.ReportEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity
import org.auibar.aris.mobile.data.local.entity.UserDashboardPreferenceEntity

@Database(
    entities = [
        // Existing v9 entities
        CampaignEntity::class,
        SubmissionEntity::class,
        FormTemplateEntity::class,
        SpeciesEntity::class,
        DiseaseEntity::class,
        GeoEntity::class,
        NotificationEntity::class,
        PhotoEntity::class,
        GpsTrackEntity::class,
        MessageEntity::class,
        KnowledgePublicationEntity::class,
        KnowledgeCategoryEntity::class,
        // New v10 entities — Chantier A (multi-target)
        CampaignTargetEntity::class,
        FormTemplateTargetEntity::class,
        // New v10 entities — Chantier C (indicators)
        IndicatorEntity::class,
        IndicatorValueEntity::class,
        // New v10 entities — Chantier B (dashboards)
        DashboardEntity::class,
        DashboardWidgetEntity::class,
        // New v10 entities — Chantier D (reports + flash)
        ReportEntity::class,
        FlashAlertEntity::class,
        // New v10 entities — user preferences
        UserDashboardPreferenceEntity::class,
        // New v11 entities — KPI snapshots
        KpiSnapshotEntity::class,
        // New v13 — generic ref data cache for offline form selects
        RefDataCacheEntity::class,
    ],
    version = 13,
    exportSchema = true,
)
abstract class ArisDatabase : RoomDatabase() {
    abstract fun campaignDao(): CampaignDao
    abstract fun campaignTargetDao(): CampaignTargetDao
    abstract fun formTemplateTargetDao(): FormTemplateTargetDao
    abstract fun submissionDao(): SubmissionDao
    abstract fun formTemplateDao(): FormTemplateDao
    abstract fun speciesDao(): SpeciesDao
    abstract fun diseaseDao(): DiseaseDao
    abstract fun geoDao(): GeoDao
    abstract fun notificationDao(): NotificationDao
    abstract fun photoDao(): PhotoDao
    abstract fun gpsTrackDao(): GpsTrackDao
    abstract fun messageDao(): MessageDao
    abstract fun knowledgeDao(): KnowledgeDao
    abstract fun indicatorDao(): IndicatorDao
    abstract fun indicatorValueDao(): IndicatorValueDao
    abstract fun dashboardDao(): DashboardDao
    abstract fun dashboardWidgetDao(): DashboardWidgetDao
    abstract fun userDashboardPreferenceDao(): UserDashboardPreferenceDao
    abstract fun reportDao(): ReportDao
    abstract fun flashAlertDao(): FlashAlertDao
    abstract fun kpiSnapshotDao(): KpiSnapshotDao
    abstract fun refDataCacheDao(): RefDataCacheDao
}
