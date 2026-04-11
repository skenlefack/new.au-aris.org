package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity

@Dao
interface FormTemplateDao {
    @Query("SELECT * FROM form_templates WHERE id = :id")
    suspend fun getById(id: String): FormTemplateEntity?

    @Query("SELECT * FROM form_templates")
    suspend fun getAll(): List<FormTemplateEntity>

    @Query("SELECT * FROM form_templates WHERE domain = :domain")
    fun getByDomain(domain: String): Flow<List<FormTemplateEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(templates: List<FormTemplateEntity>)

    @Query("DELETE FROM form_templates")
    suspend fun deleteAll()
}
