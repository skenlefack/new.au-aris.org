package org.auibar.aris.mobile.ui.campaign

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.CampaignProgressDto
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.CampaignTarget
import org.auibar.aris.mobile.data.repository.FormTemplateRepository
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.TargetUiModel
import javax.inject.Inject

data class TemplateInfo(
    val id: String,
    val name: String,
    val domain: String = "",
    val version: Int = 1,
)

data class CampaignDetailUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val campaignName: String = "",
    val description: String? = null,
    val domain: String = "",
    val domainLabel: String = "",
    val startDate: Long = 0,
    val endDate: Long = 0,
    val status: String = "",
    val targetSubmissions: Int? = null,
    val targetCountries: List<String> = emptyList(),
    val assignedAgentsCount: Int = 0,
    val templates: List<TemplateInfo> = emptyList(),
    val progress: CampaignProgressDto? = null,
    val targets: List<TargetUiModel> = emptyList(),
)

private val DOMAIN_LABELS = mapOf(
    "health" to "Animal Health & One Health",
    "livestock" to "Production & Pastoralism",
    "fisheries" to "Fisheries & Aquaculture",
    "trade" to "Trade, Markets & SPS",
    "wildlife" to "Wildlife & Biodiversity",
    "apiculture" to "Apiculture & Pollination",
    "governance" to "Governance & Capacities",
    "climate" to "Climate & Environment",
    "knowledge" to "Knowledge Management",
)

@HiltViewModel
class CampaignDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val formTemplateRepository: FormTemplateRepository,
    private val campaignApi: CampaignApi,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""

    private val _uiState = MutableStateFlow(CampaignDetailUiState())
    val uiState: StateFlow<CampaignDetailUiState> = _uiState.asStateFlow()

    val submissions: StateFlow<List<Submission>> = submissionRepository
        .getByCampaign(campaignId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val submissionCount: StateFlow<Int> = submissionRepository
        .getCountByCampaign(campaignId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    init {
        if (campaignId.isNotBlank()) {
            loadCampaignDetail()
        } else {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = "Campaign ID is missing",
            )
        }
    }

    private fun loadCampaignDetail() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            // First try to load basic info from local DB (fast)
            val localCampaign = campaignRepository.getById(campaignId)
            if (localCampaign != null) {
                val domainKey = RoleConfig.backendToMobileKey(localCampaign.domain)
                _uiState.value = _uiState.value.copy(
                    campaignName = localCampaign.name,
                    domain = domainKey,
                    domainLabel = DOMAIN_LABELS[domainKey] ?: domainKey,
                    startDate = localCampaign.startDate,
                    endDate = localCampaign.endDate,
                    status = localCampaign.status,
                    targets = localCampaign.targetUiModels,
                    isLoading = false,
                )
            }

            // Then fetch full detail from API (with progress + templates)
            try {
                val detail = campaignApi.getCampaignDetailSafe(campaignId)
                    ?: throw IllegalStateException("Campaign detail not found")
                val domainKey = RoleConfig.backendToMobileKey(detail.domain)

                // Resolve template IDs to template infos
                var allTemplateIds = detail.templateIds.ifEmpty {
                    listOfNotNull(detail.templateId).filter { it.isNotBlank() }
                }

                // If no template IDs, load published templates for this domain
                var templateInfos = resolveTemplates(allTemplateIds)
                if (templateInfos.isEmpty() && detail.domain.isNotBlank()) {
                    val domainTemplates = campaignApi.getPublishedTemplatesSafe(detail.domain)
                    templateInfos = domainTemplates.map {
                        TemplateInfo(id = it.id, name = it.name, domain = it.domain, version = it.version)
                    }
                }

                // Parse dates
                val startMs = parseIsoDate(detail.startDate)
                val endMs = parseIsoDate(detail.endDate)

                // Build target UI models from API detail
                val apiTargets = detail.targets?.map { t ->
                    val tDomain = RoleConfig.backendToMobileKey(t.domainCode)
                    TargetUiModel(
                        domainCode = tDomain,
                        domainLabel = DOMAIN_LABELS[tDomain] ?: tDomain,
                        subDomainCode = t.subDomainCode,
                        subDomainLabel = t.subDomainCode,
                        isPrimary = t.isPrimary,
                    )
                } ?: _uiState.value.targets

                _uiState.value = CampaignDetailUiState(
                    isLoading = false,
                    campaignName = detail.name,
                    description = detail.description,
                    domain = domainKey,
                    domainLabel = DOMAIN_LABELS[domainKey] ?: domainKey,
                    startDate = startMs,
                    endDate = endMs,
                    status = detail.status,
                    targetSubmissions = detail.targetSubmissions,
                    targetCountries = detail.targetCountries,
                    assignedAgentsCount = detail.assignedAgents.size,
                    templates = templateInfos,
                    progress = detail.progress,
                    targets = apiTargets,
                )
            } catch (e: Exception) {
                // If API fails, keep the local data but show error only if we have nothing
                if (localCampaign == null) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = e.message,
                    )
                } else {
                    // We have local data — try to resolve templates from local cache
                    val localTemplate = formTemplateRepository.getById(localCampaign.templateId)
                    val templates = if (localTemplate != null) {
                        listOf(TemplateInfo(
                            id = localTemplate.id,
                            name = localTemplate.name,
                            domain = localTemplate.domain,
                            version = localTemplate.version,
                        ))
                    } else {
                        listOf(TemplateInfo(
                            id = localCampaign.templateId,
                            name = "Form",
                        ))
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        templates = templates,
                    )
                }
            }
        }
    }

    private suspend fun resolveTemplates(templateIds: List<String>): List<TemplateInfo> {
        if (templateIds.isEmpty()) return emptyList()

        return templateIds.map { id ->
            viewModelScope.async {
                try {
                    // Try local cache first
                    val local = formTemplateRepository.getById(id)
                    if (local != null) {
                        return@async TemplateInfo(
                            id = local.id,
                            name = local.name,
                            domain = local.domain,
                            version = local.version,
                        )
                    }
                    // Fetch from API
                    val dto = campaignApi.getFormTemplateInfo(id)
                    if (dto != null) {
                        TemplateInfo(id = dto.id, name = dto.name, domain = dto.domain ?: "", version = dto.version)
                    } else {
                        TemplateInfo(id = id, name = "Form Template")
                    }
                } catch (_: Exception) {
                    TemplateInfo(id = id, name = "Form Template")
                }
            }
        }.awaitAll()
    }

    private fun parseIsoDate(dateStr: String): Long {
        return try {
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                .parse(dateStr)?.time ?: 0L
        } catch (_: Exception) {
            try {
                java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                    .parse(dateStr)?.time ?: 0L
            } catch (_: Exception) {
                // If it's already a number (timestamp), try parsing as Long
                dateStr.toLongOrNull() ?: 0L
            }
        }
    }

    fun refresh() {
        loadCampaignDetail()
    }
}
