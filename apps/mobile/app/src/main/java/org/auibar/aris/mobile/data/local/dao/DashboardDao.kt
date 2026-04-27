package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.DashboardEntity
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.local.entity.UserDashboardPreferenceEntity

@Dao
interface DashboardDao {
    @Query("SELECT * FROM dashboards ORDER BY titleEn")
    fun observeAll(): Flow<List<DashboardEntity>>

    @Query("SELECT * FROM dashboards WHERE scope = :scope ORDER BY titleEn")
    fun observeByScope(scope: String): Flow<List<DashboardEntity>>

    @Query("SELECT * FROM dashboards WHERE domainCode = :domainCode ORDER BY titleEn")
    fun observeByDomain(domainCode: String): Flow<List<DashboardEntity>>

    @Query("SELECT * FROM dashboards WHERE id = :id")
    fun observeById(id: String): Flow<DashboardEntity?>

    @Query("SELECT * FROM dashboards WHERE id = :id")
    suspend fun getById(id: String): DashboardEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(dashboards: List<DashboardEntity>)

    @Query("UPDATE dashboards SET cachedSnapshot = :snapshot, cachedSnapshotAt = :at WHERE id = :id")
    suspend fun updateSnapshot(id: String, snapshot: String, at: Long)
}

@Dao
interface DashboardWidgetDao {
    @Query("SELECT * FROM dashboard_widgets WHERE dashboardId = :dashboardId ORDER BY gridY, gridX")
    fun observeForDashboard(dashboardId: String): Flow<List<DashboardWidgetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(widgets: List<DashboardWidgetEntity>)

    @Query("DELETE FROM dashboard_widgets WHERE dashboardId = :dashboardId")
    suspend fun deleteForDashboard(dashboardId: String)
}

@Dao
interface UserDashboardPreferenceDao {
    @Query("SELECT * FROM user_dashboard_preferences WHERE userId = :userId")
    fun observeForUser(userId: String): Flow<List<UserDashboardPreferenceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(pref: UserDashboardPreferenceEntity)

    @Query("DELETE FROM user_dashboard_preferences WHERE id = :id")
    suspend fun delete(id: String)
}
