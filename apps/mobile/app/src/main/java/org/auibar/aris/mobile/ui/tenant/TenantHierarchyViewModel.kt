package org.auibar.aris.mobile.ui.tenant

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

data class TenantNode(
    val geo: GeoEntity,
    val children: List<TenantNode> = emptyList(),
    val isExpanded: Boolean = false,
    val isCurrentTenant: Boolean = false,
)

data class TenantHierarchyUiState(
    val currentTenantId: String? = null,
    val currentTenantName: String? = null,
    val userRole: String? = null,
    val userName: String? = null,
    val continentalNodes: List<TenantNode> = emptyList(),
    val isLoading: Boolean = true,
    val expandedIds: Set<String> = emptySet(),
)

@HiltViewModel
class TenantHierarchyViewModel @Inject constructor(
    private val geoDao: GeoDao,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TenantHierarchyUiState())
    val uiState: StateFlow<TenantHierarchyUiState> = _uiState.asStateFlow()

    init {
        loadHierarchy()
    }

    private fun loadHierarchy() {
        viewModelScope.launch {
            val tenantId = tokenManager.tenantId
            val userRole = tokenManager.userRole
            val userName = tokenManager.userFullName

            // Load top-level nodes (CONTINENTAL)
            val continentals = geoDao.getByLevel("CONTINENTAL")

            // If no continental level, try loading RECs directly
            val topLevel = continentals.ifEmpty { geoDao.getByLevel("REC") }

            val nodes = topLevel.map { geo ->
                buildNode(geo, tenantId)
            }

            // Resolve current tenant name
            val currentTenantName = if (tenantId != null) {
                geoDao.getById(tenantId)?.name ?: tenantId
            } else null

            // Auto-expand the path to the current tenant
            val expandedIds = if (tenantId != null) {
                findPathToTenant(nodes, tenantId)
            } else emptySet()

            _uiState.value = TenantHierarchyUiState(
                currentTenantId = tenantId,
                currentTenantName = currentTenantName,
                userRole = userRole,
                userName = userName,
                continentalNodes = nodes,
                isLoading = false,
                expandedIds = expandedIds,
            )
        }
    }

    private suspend fun buildNode(geo: GeoEntity, currentTenantId: String?): TenantNode {
        val children = geoDao.getChildren(geo.id)
        return TenantNode(
            geo = geo,
            children = children.map { buildNode(it, currentTenantId) },
            isCurrentTenant = geo.id == currentTenantId,
        )
    }

    fun toggleExpanded(geoId: String) {
        val current = _uiState.value.expandedIds
        _uiState.value = _uiState.value.copy(
            expandedIds = if (geoId in current) current - geoId else current + geoId,
        )
    }

    private fun findPathToTenant(nodes: List<TenantNode>, targetId: String): Set<String> {
        val path = mutableSetOf<String>()
        fun search(node: TenantNode): Boolean {
            if (node.geo.id == targetId) return true
            for (child in node.children) {
                if (search(child)) {
                    path.add(node.geo.id)
                    return true
                }
            }
            return false
        }
        nodes.forEach { search(it) }
        return path
    }
}
