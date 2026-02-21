package org.auibar.aris.mobile.util

import java.text.DateFormat
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Locale-aware formatting for dates, numbers, and percentages.
 * Uses the current app locale from LocaleManager.
 */
@Singleton
class LocaleFormatter @Inject constructor(
    private val localeManager: LocaleManager,
) {
    private val currentLocale: Locale
        get() = Locale(localeManager.currentLanguage)

    fun formatDate(date: Date, style: Int = DateFormat.MEDIUM): String {
        return DateFormat.getDateInstance(style, currentLocale).format(date)
    }

    fun formatDateTime(date: Date): String {
        return DateFormat.getDateTimeInstance(
            DateFormat.MEDIUM, DateFormat.SHORT, currentLocale
        ).format(date)
    }

    fun formatRelativeDate(timestampMs: Long): String {
        val now = System.currentTimeMillis()
        val diff = now - timestampMs
        val seconds = diff / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        val days = hours / 24

        return when {
            seconds < 60 -> when (localeManager.currentLanguage) {
                "fr" -> "\u00c0 l'instant"
                "pt" -> "Agora mesmo"
                "ar" -> "\u0627\u0644\u0622\u0646"
                else -> "Just now"
            }
            minutes < 60 -> when (localeManager.currentLanguage) {
                "fr" -> "Il y a ${minutes}min"
                "pt" -> "H\u00e1 ${minutes}min"
                "ar" -> "\u0645\u0646\u0630 ${minutes} \u062f\u0642\u064a\u0642\u0629"
                else -> "${minutes}m ago"
            }
            hours < 24 -> when (localeManager.currentLanguage) {
                "fr" -> "Il y a ${hours}h"
                "pt" -> "H\u00e1 ${hours}h"
                "ar" -> "\u0645\u0646\u0630 ${hours} \u0633\u0627\u0639\u0629"
                else -> "${hours}h ago"
            }
            days < 7 -> when (localeManager.currentLanguage) {
                "fr" -> "Il y a ${days}j"
                "pt" -> "H\u00e1 ${days}d"
                "ar" -> "\u0645\u0646\u0630 ${days} \u064a\u0648\u0645"
                else -> "${days}d ago"
            }
            else -> formatDate(Date(timestampMs))
        }
    }

    fun formatNumber(value: Long): String {
        return NumberFormat.getIntegerInstance(currentLocale).format(value)
    }

    fun formatNumber(value: Double, decimals: Int = 1): String {
        val nf = NumberFormat.getNumberInstance(currentLocale)
        nf.minimumFractionDigits = decimals
        nf.maximumFractionDigits = decimals
        return nf.format(value)
    }

    fun formatPercent(value: Double): String {
        val nf = NumberFormat.getPercentInstance(currentLocale)
        nf.minimumFractionDigits = 1
        nf.maximumFractionDigits = 1
        return nf.format(value / 100.0)
    }

    /**
     * For dynamic form labels from server: returns nameEn/nameFr/namePt/nameAr based on locale.
     */
    fun resolveLocalizedName(
        nameEn: String,
        nameFr: String? = null,
        namePt: String? = null,
        nameAr: String? = null,
    ): String {
        return when (localeManager.currentLanguage) {
            "fr" -> nameFr ?: nameEn
            "pt" -> namePt ?: nameEn
            "ar" -> nameAr ?: nameEn
            else -> nameEn
        }
    }
}
