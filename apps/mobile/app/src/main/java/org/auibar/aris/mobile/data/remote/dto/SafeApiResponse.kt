package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

/**
 * A nullable-data variant of ApiResponse for endpoints that may return
 * error objects without a `data` field.
 */
@Serializable
data class SafeApiResponse<T>(
    val data: T? = null,
    val meta: ApiMeta? = null,
    val errors: List<ApiError>? = null,
    val statusCode: Int? = null,
    val message: String? = null,
)
