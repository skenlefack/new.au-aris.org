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

@Serializable
data class DomainSubmissionCount(val domain: String, val count: Int)

@Serializable
data class SubmissionsByDomainResponse(val items: List<DomainSubmissionCount>)

@Serializable
data class TimelinePoint(val date: String, val count: Int)

@Serializable
data class SubmissionsTimelineResponse(val points: List<TimelinePoint>)

@Serializable
data class CountryBeneficiaries(val country: String, val code: String, val count: Int)

@Serializable
data class BeneficiariesByCountryResponse(val items: List<CountryBeneficiaries>)
