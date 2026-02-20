package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.NotificationDto
import javax.inject.Inject

class MessageApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getNotifications(
        page: Int = 1,
        limit: Int = 20,
    ): ApiResponse<List<NotificationDto>> {
        return client.get("/api/v1/messages") {
            parameter("page", page)
            parameter("limit", limit)
            parameter("channel", "push,in_app")
        }.body()
    }

    suspend fun markAsRead(id: String): ApiResponse<NotificationDto> {
        return client.patch("/api/v1/messages/$id/read").body()
    }
}
