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

    val isRtl: Boolean
        get() = currentLanguage == "ar"

    val supportedLanguages: List<LanguageOption> = listOf(
        LanguageOption("en", "English"),
        LanguageOption("fr", "Fran\u00e7ais"),
        LanguageOption("pt", "Portugu\u00eas"),
        LanguageOption("ar", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"),
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
        config.setLayoutDirection(locale)
        return context.createConfigurationContext(config)
    }
}

data class LanguageOption(
    val code: String,
    val displayName: String,
)
