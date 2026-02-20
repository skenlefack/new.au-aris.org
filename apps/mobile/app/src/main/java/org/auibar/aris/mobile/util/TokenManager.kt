package org.auibar.aris.mobile.util

import android.content.Context
import android.content.SharedPreferences
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

    var language: String
        get() = prefs.getString(KEY_LANGUAGE, "en") ?: "en"
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    /** Sync frequency in minutes: 15, 30, 60, or 0 for manual */
    var syncFrequencyMinutes: Int
        get() = prefs.getInt(KEY_SYNC_FREQUENCY, 15)
        set(value) = prefs.edit().putInt(KEY_SYNC_FREQUENCY, value).apply()

    val isLoggedIn: Boolean
        get() = accessToken != null

    fun clear() {
        val savedLang = language
        prefs.edit().clear().apply()
        language = savedLang
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
        private const val KEY_LANGUAGE = "language"
        private const val KEY_SYNC_FREQUENCY = "sync_frequency_minutes"
    }
}
