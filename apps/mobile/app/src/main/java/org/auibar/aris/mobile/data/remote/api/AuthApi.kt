package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.LoginRequest
import org.auibar.aris.mobile.data.remote.dto.LoginResponse
import javax.inject.Inject

class AuthApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun login(email: String, password: String): ApiResponse<LoginResponse> {
        return client.post("/api/v1/credential/login") {
            contentType(ContentType.Application.Json)
            setBody(LoginRequest(email = email, password = password))
        }.body()
    }
}
