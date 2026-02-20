package org.auibar.aris.mobile.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.GpsTrackEntity
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.local.entity.PhotoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity

@Database(
    entities = [
        CampaignEntity::class,
        SubmissionEntity::class,
        FormTemplateEntity::class,
        SpeciesEntity::class,
        DiseaseEntity::class,
        GeoEntity::class,
        NotificationEntity::class,
        PhotoEntity::class,
        GpsTrackEntity::class,
    ],
    version = 4,
    exportSchema = false
)
abstract class ArisDatabase : RoomDatabase() {
    abstract fun campaignDao(): CampaignDao
    abstract fun submissionDao(): SubmissionDao
    abstract fun formTemplateDao(): FormTemplateDao
    abstract fun speciesDao(): SpeciesDao
    abstract fun diseaseDao(): DiseaseDao
    abstract fun geoDao(): GeoDao
    abstract fun notificationDao(): NotificationDao
    abstract fun photoDao(): PhotoDao
    abstract fun gpsTrackDao(): GpsTrackDao
}
