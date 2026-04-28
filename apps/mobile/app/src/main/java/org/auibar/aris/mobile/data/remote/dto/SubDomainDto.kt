package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class SubDomainDto(
    val id: String,
    val code: String,
    val domainId: String? = null,
    val labelFr: String = "",
    val labelEn: String = "",
    val labelAr: String? = null,
    val labelPt: String? = null,
    val typeEnum: String = "OTHER",
    val active: Boolean = true,
    val displayOrder: Int = 0,
    val description: String? = null,
    val valueChainCode: String? = null,
)
