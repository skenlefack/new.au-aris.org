package org.auibar.aris.mobile.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import org.auibar.aris.mobile.data.local.ArisDatabase
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.dao.MessageDao
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ArisDatabase {
        return Room.databaseBuilder(
            context,
            ArisDatabase::class.java,
            "aris_database",
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideCampaignDao(db: ArisDatabase): CampaignDao = db.campaignDao()

    @Provides
    fun provideSubmissionDao(db: ArisDatabase): SubmissionDao = db.submissionDao()

    @Provides
    fun provideFormTemplateDao(db: ArisDatabase): FormTemplateDao = db.formTemplateDao()

    @Provides
    fun provideSpeciesDao(db: ArisDatabase): SpeciesDao = db.speciesDao()

    @Provides
    fun provideDiseaseDao(db: ArisDatabase): DiseaseDao = db.diseaseDao()

    @Provides
    fun provideGeoDao(db: ArisDatabase): GeoDao = db.geoDao()

    @Provides
    fun provideNotificationDao(db: ArisDatabase): NotificationDao = db.notificationDao()

    @Provides
    fun providePhotoDao(db: ArisDatabase): PhotoDao = db.photoDao()

    @Provides
    fun provideGpsTrackDao(db: ArisDatabase): GpsTrackDao = db.gpsTrackDao()

    @Provides
    fun provideMessageDao(db: ArisDatabase): MessageDao = db.messageDao()
}
