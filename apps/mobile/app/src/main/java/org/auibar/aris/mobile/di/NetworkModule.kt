package org.auibar.aris.mobile.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideHttpClient(
        json: Json,
        tokenManager: TokenManager,
    ): HttpClient {
        return HttpClient(Android) {
            install(ContentNegotiation) { json(json) }

            install(Logging) {
                level = if (BuildConfig.DEBUG) LogLevel.BODY else LogLevel.NONE
            }

            install(Auth) {
                bearer {
                    loadTokens {
                        val access = tokenManager.accessToken
                        val refresh = tokenManager.refreshToken
                        if (access != null && refresh != null) {
                            BearerTokens(access, refresh)
                        } else null
                    }
                }
            }

            defaultRequest {
                url(BuildConfig.API_BASE_URL)
            }

            engine {
                connectTimeout = 30_000
                socketTimeout = 30_000
            }
        }
    }

    @Provides
    @Singleton
    fun provideAuthApi(client: HttpClient): AuthApi = AuthApi(client)

    @Provides
    @Singleton
    fun provideCampaignApi(client: HttpClient): CampaignApi = CampaignApi(client)

    @Provides
    @Singleton
    fun provideSyncApi(client: HttpClient): SyncApi = SyncApi(client)

    @Provides
    @Singleton
    fun provideMessageApi(client: HttpClient): MessageApi = MessageApi(client)

    @Provides
    @Singleton
    fun provideAnalyticsApi(client: HttpClient): AnalyticsApi = AnalyticsApi(client)
}
