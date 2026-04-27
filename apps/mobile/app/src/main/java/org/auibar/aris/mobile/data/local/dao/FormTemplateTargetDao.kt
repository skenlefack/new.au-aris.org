package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateTargetEntity

@Dao
interface FormTemplateTargetDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(targets: List<FormTemplateTargetEntity>)

    @Query("DELETE FROM form_template_targets WHERE templateId = :templateId")
    suspend fun deleteForTemplate(templateId: String)

    @Transaction
    suspend fun replaceForTemplate(templateId: String, targets: List<FormTemplateTargetEntity>) {
        deleteForTemplate(templateId)
        upsertAll(targets)
    }

    @Query("SELECT * FROM form_template_targets WHERE templateId = :templateId")
    suspend fun getForTemplate(templateId: String): List<FormTemplateTargetEntity>

    @Query("""
        SELECT DISTINCT ft.* FROM form_templates ft
        INNER JOIN form_template_targets ftt ON ftt.templateId = ft.id
        WHERE ftt.domainCode = :domainCode
    """)
    fun observeTemplatesByDomain(domainCode: String): Flow<List<FormTemplateEntity>>
}
