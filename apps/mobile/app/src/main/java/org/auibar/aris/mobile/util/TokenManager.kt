package org.auibar.aris.mobile.util

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences
    val deviceId: String

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            "aris_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
        deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: java.util.UUID.randomUUID().toString()
    }

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) = prefs.edit().putString(KEY_USER_ID, value).apply()

    var userRole: String?
        get() = prefs.getString(KEY_USER_ROLE, null)
        set(value) = prefs.edit().putString(KEY_USER_ROLE, value).apply()

    var tenantId: String?
        get() = prefs.getString(KEY_TENANT_ID, null)
        set(value) = prefs.edit().putString(KEY_TENANT_ID, value).apply()

    var lastSyncAt: Long?
        get() {
            val v = prefs.getLong(KEY_LAST_SYNC, -1L)
            return if (v == -1L) null else v
        }
        set(value) = prefs.edit().putLong(KEY_LAST_SYNC, value ?: -1L).apply()

    var userFullName: String?
        get() = prefs.getString(KEY_USER_FULL_NAME, null)
        set(value) = prefs.edit().putString(KEY_USER_FULL_NAME, value).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_USER_EMAIL, null)
        set(value) = prefs.edit().putString(KEY_USER_EMAIL, value).apply()

    var tenantLevel: String?
        get() = prefs.getString(KEY_TENANT_LEVEL, null)
        set(value) = prefs.edit().putString(KEY_TENANT_LEVEL, value).apply()

    /** Comma-separated domain codes assigned to the user (e.g. "animal-health,fisheries") */
    var userDomains: String?
        get() = prefs.getString(KEY_USER_DOMAINS, null)
        set(value) = prefs.edit().putString(KEY_USER_DOMAINS, value).apply()

    /** Returns domain codes as a list */
    fun getUserDomainList(): List<String> =
        userDomains?.split(",")?.filter { it.isNotBlank() } ?: emptyList()

    /** Comma-separated system-active domain codes from server (e.g. "health,livestock,fisheries") */
    var activeDomains: String?
        get() = prefs.getString(KEY_ACTIVE_DOMAINS, null)
        set(value) = prefs.edit().putString(KEY_ACTIVE_DOMAINS, value).apply()

    /** Returns system-active domain codes as a list */
    fun getActiveDomainCodes(): List<String> =
        activeDomains?.split(",")?.filter { it.isNotBlank() } ?: emptyList()

    /** Full domain JSON from GET /api/v1/public/domains (serialized AppDomainDto list) */
    var activeDomainsJson: String?
        get() = prefs.getString(KEY_ACTIVE_DOMAINS_JSON, null)
        set(value) = prefs.edit().putString(KEY_ACTIVE_DOMAINS_JSON, value).apply()

    /** Comma-separated active locale codes from server (e.g. "en,fr") */
    var activeLocales: String?
        get() = prefs.getString(KEY_ACTIVE_LOCALES, null)
        set(value) = prefs.edit().putString(KEY_ACTIVE_LOCALES, value).apply()

    /** Returns active locale codes as a list */
    fun getActiveLocaleList(): List<String> =
        activeLocales?.split(",")?.filter { it.isNotBlank() } ?: emptyList()

    /** Firebase Cloud Messaging device token */
    var fcmToken: String?
        get() = prefs.getString(KEY_FCM_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_FCM_TOKEN, value).apply()

    var language: String
        get() = prefs.getString(KEY_LANGUAGE, "en") ?: "en"
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    /** Sync frequency in minutes: 15, 30, 60, or 0 for manual */
    var syncFrequencyMinutes: Int
        get() = prefs.getInt(KEY_SYNC_FREQUENCY, 15)
        set(value) = prefs.edit().putInt(KEY_SYNC_FREQUENCY, value).apply()

    /** Server environment: PRODUCTION or STAGING */
    var serverEnvironment: String
        get() = prefs.getString(KEY_SERVER_ENV, ServerEnvironment.STAGING.name)
            ?: ServerEnvironment.STAGING.name
        set(value) = prefs.edit().putString(KEY_SERVER_ENV, value).apply()

    val isLoggedIn: Boolean
        get() = accessToken != null

    fun clear() {
        val savedLang = language
        val savedEnv = serverEnvironment
        prefs.edit().clear().apply()
        language = savedLang
        serverEnvironment = savedEnv
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_TENANT_ID = "tenant_id"
        private const val KEY_LAST_SYNC = "last_sync_at"
        private const val KEY_USER_FULL_NAME = "user_full_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_TENANT_LEVEL = "tenant_level"
        private const val KEY_USER_DOMAINS = "user_domains"
        private const val KEY_ACTIVE_DOMAINS = "active_domains"
        private const val KEY_ACTIVE_LOCALES = "active_locales"
        private const val KEY_LANGUAGE = "language"
        private const val KEY_SYNC_FREQUENCY = "sync_frequency_minutes"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_ACTIVE_DOMAINS_JSON = "active_domains_json"
        private const val KEY_SERVER_ENV = "server_environment"
    }
}

enum class ServerEnvironment(val label: String, val baseUrl: String) {
    PRODUCTION("Production", org.auibar.aris.mobile.BuildConfig.API_BASE_URL_PROD),
    PRODUCTION_OFFICE("Bureau (LAN)", org.auibar.aris.mobile.BuildConfig.API_BASE_URL_OFFICE),
    STAGING("Staging (test)", org.auibar.aris.mobile.BuildConfig.API_BASE_URL_STG);

    /** Whether this environment points to an internal IP (needs SSL hostname bypass) */
    val isInternalIp: Boolean get() = baseUrl.contains("10.202.101.")

    companion object {
        fun fromName(name: String): ServerEnvironment =
            entries.find { it.name == name } ?: STAGING
    }
}
