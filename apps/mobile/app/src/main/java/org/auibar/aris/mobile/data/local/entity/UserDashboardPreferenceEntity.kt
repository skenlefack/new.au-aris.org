package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "user_dashboard_preferences",
    indices = [
        Index(
            value = ["userId", "scope", "domainCode", "subDomainCode", "valueChainCode"],
            unique = true,
            name = "idx_user_dashboard_pref_unique",
        ),
    ],
)
data class UserDashboardPreferenceEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val scope: String,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val valueChainCode: String? = null,
    val dashboardId: String,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
