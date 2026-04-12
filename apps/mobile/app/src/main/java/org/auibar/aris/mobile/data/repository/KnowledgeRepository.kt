package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.data.cache.CachePolicy
import org.auibar.aris.mobile.data.local.dao.KnowledgeDao
import org.auibar.aris.mobile.data.local.entity.KnowledgeCategoryEntity
import org.auibar.aris.mobile.data.local.entity.KnowledgePublicationEntity
import org.auibar.aris.mobile.data.remote.api.KnowledgeApi
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCategoryDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCourseDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeEnrollmentDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgePublicationDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeStatsDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KnowledgeRepository @Inject constructor(
    private val api: KnowledgeApi,
    private val dao: KnowledgeDao,
    private val cachePolicy: CachePolicy,
) {
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private const val CACHE_KEY_PUBLICATIONS = "cache_knowledge_publications"
        private const val CACHE_KEY_CATEGORIES = "cache_knowledge_categories"
        /** Knowledge content stale after 15 minutes */
        private const val KNOWLEDGE_TTL_MS = 15 * 60 * 1000L
    }

    /**
     * Stale-while-revalidate: returns cached publications immediately,
     * fetches fresh data if stale or forced.
     */
    suspend fun getPublications(
        forceRefresh: Boolean = false,
        page: Int = 1,
        limit: Int = 20,
        categoryId: String? = null,
        type: String? = null,
    ): Result<List<KnowledgePublicationDto>> {
        val cached = dao.getAllPublications().first()
        val isStale = cached.isEmpty() || cachePolicy.isStale(CACHE_KEY_PUBLICATIONS, KNOWLEDGE_TTL_MS)

        if (!forceRefresh && cached.isNotEmpty() && !isStale) {
            return Result.success(cached.map { it.toDto() })
        }

        return try {
            val response = api.getPublications(page, limit, categoryId, type)
            val publications = response.data.data
            dao.clearPublications()
            dao.insertPublications(publications.map { it.toEntity() })
            cachePolicy.markRefreshed(CACHE_KEY_PUBLICATIONS)
            Result.success(publications)
        } catch (e: Exception) {
            if (cached.isNotEmpty()) {
                Result.success(cached.map { it.toDto() })
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun getArticle(id: String): Result<KnowledgePublicationDto> {
        return try {
            val response = api.getPublicationById(id)
            Result.success(response.data)
        } catch (e: Exception) {
            val cached = dao.getPublicationById(id)
            if (cached != null) {
                Result.success(cached.toDto())
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun getCategories(forceRefresh: Boolean = false): Result<List<KnowledgeCategoryDto>> {
        val cached = dao.getAllCategories().first()
        val isStale = cached.isEmpty() || cachePolicy.isStale(CACHE_KEY_CATEGORIES, KNOWLEDGE_TTL_MS)

        if (!forceRefresh && cached.isNotEmpty() && !isStale) {
            return Result.success(cached.map { it.toDto() })
        }

        return try {
            val response = api.getCategories()
            val categories = response.data
            dao.clearCategories()
            dao.insertCategories(categories.map { it.toEntity() })
            cachePolicy.markRefreshed(CACHE_KEY_CATEGORIES)
            Result.success(categories)
        } catch (e: Exception) {
            if (cached.isNotEmpty()) {
                Result.success(cached.map { it.toDto() })
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun search(query: String, page: Int = 1, limit: Int = 20): Result<List<KnowledgePublicationDto>> {
        return try {
            val response = api.search(query, page, limit)
            Result.success(response.data.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCourses(page: Int = 1, limit: Int = 20): Result<List<KnowledgeCourseDto>> {
        return try {
            val response = api.getCourses(page, limit)
            Result.success(response.data.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCourse(id: String): Result<KnowledgeCourseDto> {
        return try {
            val response = api.getCourseById(id)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun enrollInCourse(id: String): Result<KnowledgeEnrollmentDto> {
        return try {
            val response = api.enrollInCourse(id)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProgress(
        courseId: String,
        completedModules: List<String>,
        progress: Int,
    ): Result<KnowledgeEnrollmentDto> {
        return try {
            val response = api.updateCourseProgress(courseId, completedModules, progress)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStats(): Result<KnowledgeStatsDto> {
        return try {
            val response = api.getStats()
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ── Entity <-> DTO mapping ──

    private fun KnowledgePublicationDto.toEntity() = KnowledgePublicationEntity(
        id = id,
        type = type,
        titleJson = json.encodeToString(title),
        summaryJson = json.encodeToString(summary),
        contentHtmlJson = json.encodeToString(contentHtml),
        slug = slug,
        tagsJson = json.encodeToString(tags),
        coverImageUrl = coverImageId,
        categoryId = categoryId,
        publishedAt = publishedAt,
        cachedAt = System.currentTimeMillis(),
    )

    private fun KnowledgePublicationEntity.toDto() = KnowledgePublicationDto(
        id = id,
        type = type,
        status = "PUBLISHED",
        title = runCatching { json.decodeFromString<Map<String, String>>(titleJson) }.getOrDefault(emptyMap()),
        summary = runCatching { json.decodeFromString<Map<String, String>>(summaryJson) }.getOrDefault(emptyMap()),
        contentHtml = runCatching { json.decodeFromString<Map<String, String>>(contentHtmlJson) }.getOrDefault(emptyMap()),
        slug = slug,
        tags = runCatching { json.decodeFromString<List<String>>(tagsJson) }.getOrDefault(emptyList()),
        coverImageId = coverImageUrl,
        viewCount = 0,
        categoryId = categoryId,
        publishedAt = publishedAt,
        createdAt = publishedAt ?: "",
    )

    private fun KnowledgeCategoryDto.toEntity() = KnowledgeCategoryEntity(
        id = id,
        nameJson = json.encodeToString(mapOf("en" to nameEn, "fr" to nameFr, "pt" to namePt, "ar" to nameAr)),
        slug = slug,
        parentId = parentId,
        scope = scope,
        icon = icon,
        color = color,
    )

    private fun KnowledgeCategoryEntity.toDto(): KnowledgeCategoryDto {
        val names = runCatching { json.decodeFromString<Map<String, String>>(nameJson) }.getOrDefault(emptyMap())
        return KnowledgeCategoryDto(
            id = id,
            nameEn = names["en"] ?: "",
            nameFr = names["fr"] ?: "",
            namePt = names["pt"] ?: "",
            nameAr = names["ar"] ?: "",
            slug = slug,
            parentId = parentId,
            scope = scope,
            icon = icon,
            color = color,
        )
    }
}
