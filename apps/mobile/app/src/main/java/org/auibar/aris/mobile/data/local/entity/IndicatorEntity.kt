package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "indicators",
    indices = [
        Index(value = ["code"], unique = true),
        Index("domainCode"),
        Index("subDomainCode"),
        Index("typeCode"),
    ],
)
data class IndicatorEntity(
    @PrimaryKey val id: String,
    val code: String,
    val nameFr: String,
    val nameEn: String,
    val nameAr: String? = null,
    val namePt: String? = null,
    val descriptionFr: String? = null,
    val descriptionEn: String? = null,
    val typeCode: String,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val unit: String,
    @ColumnInfo(defaultValue = "2") val decimalPlaces: Int = 2,
    val targetValue: Double? = null,
    @ColumnInfo(defaultValue = "1") val betterIsHigher: Boolean = true,
    val measurementMode: String,
    val formulaExpression: String? = null,
    val lastValue: Double? = null,
    val lastValueAt: Long? = null,
    val previousValue: Double? = null,
    val trend: String? = null,
    @ColumnInfo(defaultValue = "1") val active: Boolean = true,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
