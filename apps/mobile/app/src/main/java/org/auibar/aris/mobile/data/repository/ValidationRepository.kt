package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.remote.api.ValidationApi
import org.auibar.aris.mobile.data.remote.api.ValidationItemDto
import org.auibar.aris.mobile.data.remote.api.ValidationMeta
import javax.inject.Inject

data class ValidationListResult(
    val items: List<ValidationItemDto>,
    val meta: ValidationMeta?,
)

class ValidationRepository @Inject constructor(
    private val validationApi: ValidationApi,
) {

    suspend fun getValidations(
        page: Int = 1,
        limit: Int = 10,
        level: Int? = null,
        status: String? = null,
        entityType: String? = null,
    ): Result<ValidationListResult> {
        return try {
            val response = validationApi.getValidations(
                page = page,
                limit = limit,
                level = level,
                status = status,
                entityType = entityType,
            )
            Result.success(
                ValidationListResult(
                    items = response.data,
                    meta = response.meta,
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun approve(id: String, comment: String?): Boolean {
        return validationApi.performAction(id, "approve", comment = comment)
    }

    suspend fun reject(id: String, reason: String, comment: String? = null): Boolean {
        return validationApi.performAction(id, "reject", comment = comment, reason = reason)
    }

    suspend fun returnItem(id: String, reason: String, comment: String? = null): Boolean {
        return validationApi.performAction(id, "return", comment = comment, reason = reason)
    }
}
