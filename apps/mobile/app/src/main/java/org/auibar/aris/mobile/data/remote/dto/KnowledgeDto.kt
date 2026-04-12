package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class PaginatedResponse<T>(
    val data: List<T>,
    val meta: PaginatedMeta,
)

@Serializable
data class PaginatedMeta(
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
)

@Serializable
data class KnowledgePublicationDto(
    val id: String,
    val type: String,
    val status: String,
    val title: Map<String, String> = emptyMap(),
    val summary: Map<String, String> = emptyMap(),
    val contentHtml: Map<String, String> = emptyMap(),
    val slug: String,
    val tags: List<String> = emptyList(),
    val coverImageId: String? = null,
    val viewCount: Int = 0,
    val categoryId: String? = null,
    val publishedAt: String? = null,
    val createdAt: String,
)

@Serializable
data class KnowledgeCategoryDto(
    val id: String,
    val nameEn: String = "",
    val nameFr: String = "",
    val namePt: String = "",
    val nameAr: String = "",
    val slug: String,
    val parentId: String? = null,
    val scope: String = "",
    val icon: String? = null,
    val color: String? = null,
    val children: List<KnowledgeCategoryDto>? = null,
)

@Serializable
data class KnowledgeCourseDto(
    val id: String,
    val title: Map<String, String> = emptyMap(),
    val description: Map<String, String> = emptyMap(),
    val status: String = "",
    val estimatedHours: Double? = null,
    val modules: List<KnowledgeCourseModuleDto>? = null,
    val tags: List<String>? = null,
    val coverImageId: String? = null,
)

@Serializable
data class KnowledgeCourseModuleDto(
    val id: String,
    val title: Map<String, String> = emptyMap(),
    val content: Map<String, String>? = null,
    val sortOrder: Int = 0,
    val durationMinutes: Int? = null,
)

@Serializable
data class KnowledgeEnrollmentDto(
    val id: String,
    val userId: String,
    val courseId: String,
    val progress: Int = 0,
    val completedModules: List<String> = emptyList(),
    val enrolledAt: String,
    val completedAt: String? = null,
)

@Serializable
data class KnowledgeStatsDto(
    val totalPublications: Int = 0,
    val totalCourses: Int = 0,
    val totalCategories: Int = 0,
)
