package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class KpiCard(
    val key: String,       // "active_outbreaks", "total_reports", "pending_validation", "vaccination_coverage"
    val label: String,
    val value: Double,
    val unit: String = "",
    val trend: String = "stable", // up | down | stable
    val trendPercent: Double = 0.0,
)

@Serializable
data class KpiResponse(
    val kpis: List<KpiCard>,
    val asOf: String,
)
