package org.auibar.aris.mobile.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.data.repository.CampaignRepository
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
}
