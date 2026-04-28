package org.auibar.aris.mobile.di

import android.util.Log
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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.DashboardMobileApi
import org.auibar.aris.mobile.data.remote.api.FlashAlertApi
import org.auibar.aris.mobile.data.remote.api.IndicatorApi
import org.auibar.aris.mobile.data.remote.api.KnowledgeApi
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.api.ReportApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.util.ServerEnvironment
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Singleton

private const val TAG = "NetworkModule"

/** Minimal response shape for refresh — nullable data to handle errors. */
@Serializable
private data class RefreshResponse(
    val data: RefreshData? = null,
    val statusCode: Int? = null,
    val message: String? = null,
)

@Serializable
private data class RefreshData(
    val accessToken: String,
    val refreshToken: String,
)

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
                level = if (BuildConfig.DEBUG) LogLevel.HEADERS else LogLevel.NONE
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
                        Log.d(TAG, "Token refresh triggered")
                        val refresh = tokenManager.refreshToken
                            ?: oldTokens?.refreshToken
                            ?: return@refreshTokens null.also { Log.w(TAG, "No refresh token available") }

                        try {
                            // Use a SEPARATE bare client to avoid recursive 401 loop
                            val env = ServerEnvironment.fromName(tokenManager.serverEnvironment)
                            val bareClient = io.ktor.client.HttpClient(Android) {
                                install(ContentNegotiation) { json(provideJson()) }
                                engine {
                                    connectTimeout = 15_000
                                    socketTimeout = 15_000
                                    sslManager = { conn ->
                                        if (env.isInternalIp) {
                                            conn.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
                                        }
                                    }
                                }
                            }

                            val response = bareClient.post("${env.baseUrl}/api/v1/credential/auth/refresh") {
                                contentType(io.ktor.http.ContentType.Application.Json)
                                setBody(mapOf("refreshToken" to refresh))
                            }
                            bareClient.close()

                            if (response.status.value !in 200..299) {
                                Log.w(TAG, "Refresh returned ${response.status.value}")
                                tokenManager.accessToken = null
                                tokenManager.refreshToken = null
                                return@refreshTokens null
                            }

                            val body: RefreshResponse = response.body()
                            val data = body.data
                            if (data == null) {
                                Log.w(TAG, "Refresh no data: ${body.message}")
                                return@refreshTokens null
                            }

                            tokenManager.accessToken = data.accessToken
                            tokenManager.refreshToken = data.refreshToken
                            Log.d(TAG, "Token refreshed OK")
                            BearerTokens(data.accessToken, data.refreshToken)
                        } catch (e: Exception) {
                            Log.e(TAG, "Token refresh error: ${e.message}")
                            null
                        }
                    }
                    // Send auth on ALL requests (not just those with WWW-Authenticate)
                    sendWithoutRequest { true }
                }
            }

            // Dynamic base URL
            defaultRequest {
                val env = ServerEnvironment.fromName(tokenManager.serverEnvironment)
                url(env.baseUrl)
            }

            engine {
                connectTimeout = 30_000
                socketTimeout = 30_000
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

    @Provides
    @Singleton
    fun provideIndicatorApi(client: HttpClient, tokenManager: TokenManager): IndicatorApi =
        IndicatorApi(client, ServerEnvironment.fromName(tokenManager.serverEnvironment).baseUrl)

    @Provides
    @Singleton
    fun provideDashboardMobileApi(client: HttpClient, tokenManager: TokenManager): DashboardMobileApi =
        DashboardMobileApi(client, ServerEnvironment.fromName(tokenManager.serverEnvironment).baseUrl)

    @Provides
    @Singleton
    fun provideReportApi(client: HttpClient, tokenManager: TokenManager): ReportApi =
        ReportApi(client, ServerEnvironment.fromName(tokenManager.serverEnvironment).baseUrl)

    @Provides
    @Singleton
    fun provideFlashAlertApi(client: HttpClient, tokenManager: TokenManager): FlashAlertApi =
        FlashAlertApi(client, ServerEnvironment.fromName(tokenManager.serverEnvironment).baseUrl)
}
