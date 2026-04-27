package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "form_template_targets",
    foreignKeys = [
        ForeignKey(
            entity = FormTemplateEntity::class,
            parentColumns = ["id"],
            childColumns = ["templateId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("templateId"),
        Index("domainCode"),
    ],
)
data class FormTemplateTargetEntity(
    @PrimaryKey val id: String,
    val templateId: String,
    val domainCode: String,
    val subDomainCode: String?,
    val isPrimary: Boolean = false,
    val syncedAt: Long = 0L,
)
