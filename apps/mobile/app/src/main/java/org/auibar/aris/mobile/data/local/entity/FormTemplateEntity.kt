package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "form_templates")
data class FormTemplateEntity(
    @PrimaryKey val id: String,
    val name: String,
    val domain: String,
    val schema: String,
    val uiSchema: String,
    val version: Int,
    val syncedAt: Long
)
