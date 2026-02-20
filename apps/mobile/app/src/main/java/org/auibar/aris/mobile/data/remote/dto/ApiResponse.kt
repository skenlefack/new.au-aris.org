package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class ApiResponse<T>(
    val data: T,
    val meta: ApiMeta? = null,
    val errors: List<ApiError>? = null,
)

@Serializable
data class ApiMeta(
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
)

@Serializable
data class ApiError(
    val field: String,
    val message: String,
)
