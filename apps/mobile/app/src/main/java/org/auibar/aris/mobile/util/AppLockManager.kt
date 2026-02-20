package org.auibar.aris.mobile.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppLockManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            "aris_lock_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var isBiometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, value).apply()

    var isPinEnabled: Boolean
        get() = prefs.getBoolean(KEY_PIN_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_PIN_ENABLED, value).apply()

    val isLockEnabled: Boolean
        get() = isBiometricEnabled || isPinEnabled

    private var storedPinHash: String?
        get() = prefs.getString(KEY_PIN_HASH, null)
        set(value) = prefs.edit().putString(KEY_PIN_HASH, value).apply()

    private var lastActiveTimestamp: Long
        get() = prefs.getLong(KEY_LAST_ACTIVE, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_ACTIVE, value).apply()

    fun setPin(pin: String) {
        storedPinHash = hashPin(pin)
        isPinEnabled = true
    }

    fun verifyPin(pin: String): Boolean {
        val stored = storedPinHash ?: return false
        return hashPin(pin) == stored
    }

    fun removePin() {
        storedPinHash = null
        isPinEnabled = false
    }

    fun recordActivity() {
        lastActiveTimestamp = System.currentTimeMillis()
    }

    fun shouldLock(): Boolean {
        if (!isLockEnabled) return false
        val elapsed = System.currentTimeMillis() - lastActiveTimestamp
        return elapsed > LOCK_TIMEOUT_MS
    }

    fun clearLockState() {
        prefs.edit().clear().apply()
    }

    private fun hashPin(pin: String): String {
        val bytes = java.security.MessageDigest.getInstance("SHA-256")
            .digest(pin.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"
        private const val KEY_PIN_ENABLED = "pin_enabled"
        private const val KEY_PIN_HASH = "pin_hash"
        private const val KEY_LAST_ACTIVE = "last_active_at"
        const val LOCK_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes
    }
}
