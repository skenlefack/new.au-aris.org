package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCategoryDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCourseDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeEnrollmentDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgePublicationDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeStatsDto
import org.auibar.aris.mobile.data.remote.dto.PaginatedResponse
import javax.inject.Inject

class KnowledgeApi @Inject constructor(private val client: HttpClient) {

    suspend fun getPublications(
        page: Int = 1,
        limit: Int = 20,
        categoryId: String? = null,
        type: String? = null,
    ): ApiResponse<PaginatedResponse<KnowledgePublicationDto>> {
        return client.get("/api/v1/knowledge/publications/public") {
            parameter("page", page)
            parameter("limit", limit)
            categoryId?.let { parameter("categoryId", it) }
            type?.let { parameter("type", it) }
        }.body()
    }

    suspend fun getPublicationById(id: String): ApiResponse<KnowledgePublicationDto> {
        return client.get("/api/v1/knowledge/publications/public/$id").body()
    }

    suspend fun getPublicationBySlug(slug: String): ApiResponse<KnowledgePublicationDto> {
        return client.get("/api/v1/knowledge/publications/public/by-slug/$slug").body()
    }

    suspend fun getStats(): ApiResponse<KnowledgeStatsDto> {
        return client.get("/api/v1/knowledge/publications/public/stats").body()
    }

    suspend fun getCategories(): ApiResponse<List<KnowledgeCategoryDto>> {
        return client.get("/api/v1/knowledge/categories/public").body()
    }

    suspend fun getCategoryBySlug(slug: String): ApiResponse<KnowledgeCategoryDto> {
        return client.get("/api/v1/knowledge/categories/public/by-slug/$slug").body()
    }

    suspend fun search(
        query: String,
        page: Int = 1,
        limit: Int = 20,
    ): ApiResponse<PaginatedResponse<KnowledgePublicationDto>> {
        return client.get("/api/v1/knowledge/search") {
            parameter("q", query)
            parameter("page", page)
            parameter("limit", limit)
        }.body()
    }

    suspend fun getCourses(
        page: Int = 1,
        limit: Int = 20,
    ): ApiResponse<PaginatedResponse<KnowledgeCourseDto>> {
        return client.get("/api/v1/knowledge/courses/public") {
            parameter("page", page)
            parameter("limit", limit)
        }.body()
    }

    suspend fun getCourseById(id: String): ApiResponse<KnowledgeCourseDto> {
        return client.get("/api/v1/knowledge/courses/public/$id").body()
    }

    suspend fun enrollInCourse(id: String): ApiResponse<KnowledgeEnrollmentDto> {
        return client.post("/api/v1/knowledge/courses/$id/enroll").body()
    }

    suspend fun updateCourseProgress(
        courseId: String,
        completedModules: List<String>,
        progress: Int,
    ): ApiResponse<KnowledgeEnrollmentDto> {
        return client.post("/api/v1/knowledge/courses/$courseId/progress") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("completedModules" to completedModules, "progress" to progress))
        }.body()
    }
}
