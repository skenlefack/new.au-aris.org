package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity

/**
 * Generic cache for master data reference items (species, diseases, breeds,
 * age-groups, vaccine-types, control-measures, zones, etc.).
 * Keyed by (type, itemId) so different master data types can coexist.
 */
@Entity(tableName = "ref_data_cache", primaryKeys = ["type", "itemId"])
data class RefDataCacheEntity(
    val type: String,       // e.g. "species", "diseases", "breeds", "age-groups"
    val itemId: String,     // UUID of the item
    val label: String,      // Display label (already resolved for locale)
    val parentId: String? = null, // For cascading filters
    val sortOrder: Int = 0,
    val cachedAt: Long = System.currentTimeMillis(),
)
