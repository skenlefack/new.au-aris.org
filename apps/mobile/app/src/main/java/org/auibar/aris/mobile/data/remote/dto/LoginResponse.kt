package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int = 0,
    val user: UserDto? = null,
    val mfaRequired: Boolean = false,
)

@Serializable
data class DomainDto(
    val id: String,
    val code: String,
    val name: Map<String, String> = emptyMap(),
    val icon: String = "",
    val color: String = "",
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val firstName: String = "",
    val lastName: String = "",
    val role: String,
    val tenantId: String,
    val tenantLevel: String = "",
    val domains: List<DomainDto> = emptyList(),
)
