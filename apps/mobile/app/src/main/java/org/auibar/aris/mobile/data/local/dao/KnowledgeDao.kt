package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.KnowledgeCategoryEntity
import org.auibar.aris.mobile.data.local.entity.KnowledgePublicationEntity

@Dao
interface KnowledgeDao {

    @Query("SELECT * FROM knowledge_publications ORDER BY publishedAt DESC")
    fun getAllPublications(): Flow<List<KnowledgePublicationEntity>>

    @Query("SELECT * FROM knowledge_publications WHERE id = :id")
    suspend fun getPublicationById(id: String): KnowledgePublicationEntity?

    @Query("SELECT * FROM knowledge_publications WHERE categoryId = :categoryId ORDER BY publishedAt DESC")
    fun getPublicationsByCategory(categoryId: String): Flow<List<KnowledgePublicationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPublications(pubs: List<KnowledgePublicationEntity>)

    @Query("SELECT * FROM knowledge_categories ORDER BY nameJson ASC")
    fun getAllCategories(): Flow<List<KnowledgeCategoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(cats: List<KnowledgeCategoryEntity>)

    @Query("DELETE FROM knowledge_publications")
    suspend fun clearPublications()

    @Query("DELETE FROM knowledge_categories")
    suspend fun clearCategories()
}
