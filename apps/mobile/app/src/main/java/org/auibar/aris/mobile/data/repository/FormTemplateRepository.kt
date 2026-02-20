package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import javax.inject.Inject

data class FormTemplate(
    val id: String,
    val name: String,
    val domain: String,
    val schema: String,
    val uiSchema: String,
    val version: Int,
)

class FormTemplateRepository @Inject constructor(
    private val formTemplateDao: FormTemplateDao,
) {
    suspend fun getById(id: String): FormTemplate? {
        return formTemplateDao.getById(id)?.toDomain()
    }

    suspend fun getAll(): List<FormTemplate> {
        return formTemplateDao.getAll().map { it.toDomain() }
    }

    private fun FormTemplateEntity.toDomain() = FormTemplate(
        id = id,
        name = name,
        domain = domain,
        schema = schema,
        uiSchema = uiSchema,
        version = version,
    )
}
