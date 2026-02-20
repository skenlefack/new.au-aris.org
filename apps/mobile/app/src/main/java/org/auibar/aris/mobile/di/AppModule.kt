package org.auibar.aris.mobile.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardRepository
import org.auibar.aris.mobile.data.repository.FormTemplateRepository
import org.auibar.aris.mobile.data.repository.GpsTrackRepository
import org.auibar.aris.mobile.data.repository.NotificationRepository
import org.auibar.aris.mobile.data.repository.PhotoRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.data.repository.SyncRepository
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        authApi: AuthApi,
        tokenManager: TokenManager,
    ): AuthRepository = AuthRepository(authApi, tokenManager)

    @Provides
    @Singleton
    fun provideCampaignRepository(
        campaignDao: CampaignDao,
        campaignApi: CampaignApi,
    ): CampaignRepository = CampaignRepository(campaignDao, campaignApi)

    @Provides
    @Singleton
    fun provideSubmissionRepository(
        submissionDao: SubmissionDao,
    ): SubmissionRepository = SubmissionRepository(submissionDao)

    @Provides
    @Singleton
    fun provideFormTemplateRepository(
        formTemplateDao: FormTemplateDao,
    ): FormTemplateRepository = FormTemplateRepository(formTemplateDao)

    @Provides
    @Singleton
    fun provideSyncRepository(
        syncApi: SyncApi,
        submissionDao: SubmissionDao,
        campaignDao: CampaignDao,
        formTemplateDao: FormTemplateDao,
        speciesDao: SpeciesDao,
        diseaseDao: DiseaseDao,
        geoDao: GeoDao,
        tokenManager: TokenManager,
    ): SyncRepository = SyncRepository(
        syncApi, submissionDao, campaignDao, formTemplateDao,
        speciesDao, diseaseDao, geoDao, tokenManager,
    )

    @Provides
    @Singleton
    fun provideNotificationRepository(
        notificationDao: NotificationDao,
        messageApi: MessageApi,
        tokenManager: TokenManager,
    ): NotificationRepository = NotificationRepository(notificationDao, messageApi, tokenManager)

    @Provides
    @Singleton
    fun provideDashboardRepository(
        analyticsApi: AnalyticsApi,
        campaignRepository: CampaignRepository,
        submissionRepository: SubmissionRepository,
    ): DashboardRepository = DashboardRepository(analyticsApi, campaignRepository, submissionRepository)

    @Provides
    @Singleton
    fun providePhotoRepository(
        photoDao: PhotoDao,
    ): PhotoRepository = PhotoRepository(photoDao)

    @Provides
    @Singleton
    fun provideGpsTrackRepository(
        gpsTrackDao: GpsTrackDao,
    ): GpsTrackRepository = GpsTrackRepository(gpsTrackDao)
}
