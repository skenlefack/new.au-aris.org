package org.auibar.aris.mobile.util

import android.content.Context
import android.content.res.Configuration
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the application locale based on user preference stored in TokenManager.
 * Applies the selected locale to the app configuration.
 */
@Singleton
class LocaleManager @Inject constructor(
    private val tokenManager: TokenManager,
) {

    val currentLanguage: String
        get() = tokenManager.language

    val supportedLanguages: List<LanguageOption> = listOf(
        LanguageOption("en", "English"),
        LanguageOption("fr", "Fran\u00e7ais"),
    )

    fun setLanguage(languageCode: String) {
        tokenManager.language = languageCode
    }

    /**
     * Apply the stored locale to a Context. Call from attachBaseContext().
     */
    fun applyLocale(context: Context): Context {
        val locale = Locale(tokenManager.language)
        Locale.setDefault(locale)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}

data class LanguageOption(
    val code: String,
    val displayName: String,
)
