package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "kpi_snapshots")
data class KpiSnapshotEntity(
    @PrimaryKey val id: String,       // "continental", "charts", "domain_health", etc.
    val kpisJson: String = "[]",       // Serialized List<KpiCard>
    val chartsJson: String? = null,    // Serialized DashboardChartsResponse
    val fetchedAt: Long = System.currentTimeMillis(),
)
