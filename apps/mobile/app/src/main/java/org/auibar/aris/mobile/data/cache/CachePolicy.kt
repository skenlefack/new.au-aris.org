package org.auibar.aris.mobile.data.cache

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages cache timestamps and TTL for different data types.
 * Determines when cached data is stale and needs refreshing.
 */
@Singleton
class CachePolicy @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("aris_cache_policy", Context.MODE_PRIVATE)

    /** Master data (species, diseases, countries): refresh daily (24h) */
    val masterDataTtlMs: Long = 24 * 60 * 60 * 1000L

    /** Campaigns: refresh on app start + pull-to-refresh, stale after 1h */
    val campaignsTtlMs: Long = 60 * 60 * 1000L

    /** Form templates: refresh when campaign loaded, stale after 6h */
    val templatesTtlMs: Long = 6 * 60 * 60 * 1000L

    fun isStale(key: String, ttlMs: Long): Boolean {
        val lastRefresh = prefs.getLong(key, 0L)
        return System.currentTimeMillis() - lastRefresh > ttlMs
    }

    fun markRefreshed(key: String) {
        prefs.edit().putLong(key, System.currentTimeMillis()).apply()
    }

    fun getLastRefresh(key: String): Long {
        return prefs.getLong(key, 0L)
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    companion object {
        const val KEY_MASTER_SPECIES = "cache_master_species"
        const val KEY_MASTER_DISEASES = "cache_master_diseases"
        const val KEY_MASTER_GEO = "cache_master_geo"
        const val KEY_CAMPAIGNS = "cache_campaigns"
        const val KEY_TEMPLATES = "cache_templates"
    }
}
