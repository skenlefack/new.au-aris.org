package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "knowledge_publications",
    indices = [
        Index("categoryId"),
        Index("publishedAt"),
    ],
)
data class KnowledgePublicationEntity(
    @PrimaryKey val id: String,
    val type: String,
    val titleJson: String,
    val summaryJson: String,
    val contentHtmlJson: String,
    val slug: String,
    val tagsJson: String,
    val coverImageUrl: String? = null,
    val categoryId: String? = null,
    val publishedAt: String? = null,
    val cachedAt: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "knowledge_categories",
)
data class KnowledgeCategoryEntity(
    @PrimaryKey val id: String,
    val nameJson: String,
    val slug: String,
    val parentId: String? = null,
    val scope: String = "",
    val icon: String? = null,
    val color: String? = null,
)
