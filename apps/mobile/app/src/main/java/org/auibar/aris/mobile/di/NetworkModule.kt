package org.auibar.aris.mobile.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.call.body
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.contentType
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.KnowledgeApi
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.util.ServerEnvironment
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @OptIn(ExperimentalSerializationApi::class)
    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideHttpClient(
        json: Json,
        tokenManager: TokenManager,
    ): HttpClient {
        return HttpClient(Android) {
            expectSuccess = false
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
                    refreshTokens {
                        val refresh = oldTokens?.refreshToken ?: return@refreshTokens null
                        try {
                            val response = client.post("/api/v1/credential/auth/refresh") {
                                markAsRefreshTokenRequest()
                                contentType(io.ktor.http.ContentType.Application.Json)
                                setBody(mapOf("refreshToken" to refresh))
                            }
                            val body = response.body<org.auibar.aris.mobile.data.remote.dto.ApiResponse<org.auibar.aris.mobile.data.remote.dto.LoginResponse>>()
                            val newAccess = body.data.accessToken
                            val newRefresh = body.data.refreshToken
                            tokenManager.accessToken = newAccess
                            tokenManager.refreshToken = newRefresh
                            BearerTokens(newAccess, newRefresh)
                        } catch (e: Exception) {
                            android.util.Log.e("NetworkModule", "Token refresh failed", e)
                            null
                        }
                    }
                }
            }

            // Dynamic base URL — reads current environment on every request
            defaultRequest {
                val env = ServerEnvironment.fromName(tokenManager.serverEnvironment)
                url(env.baseUrl)
            }

            engine {
                connectTimeout = 30_000
                socketTimeout = 30_000
                // Bypass hostname verification for internal IPs (cert is issued for au-aris.org)
                sslManager = { httpsURLConnection ->
                    val env = ServerEnvironment.fromName(tokenManager.serverEnvironment)
                    if (env.isInternalIp) {
                        httpsURLConnection.hostnameVerifier =
                            javax.net.ssl.HostnameVerifier { _, _ -> true }
                    }
                }
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

    @Provides
    @Singleton
    fun provideKnowledgeApi(client: HttpClient): KnowledgeApi = KnowledgeApi(client)
}
