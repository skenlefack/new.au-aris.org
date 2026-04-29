package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.CampaignDetailDto
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.TemplateInfoDto
import javax.inject.Inject

private const val TAG = "CampaignApi"

/** DTO for template API — schema/uiSchema are JSON objects, not strings. */
@Serializable
private data class RawFormTemplateDto(
    val id: String,
    val name: String = "",
    val domain: String = "",
    val schema: JsonElement? = null,
    val uiSchema: JsonElement? = null,
    val version: Int = 1,
) {
    fun toFormTemplateDto(): FormTemplateDto = FormTemplateDto(
        id = id, name = name, domain = domain,
        schema = schema?.toString() ?: "{}",
        uiSchema = uiSchema?.toString() ?: "{}",
        version = version,
    )
}

/**
 * DTO for /api/v1/workflow/campaigns — name/description are JSON objects {en, fr, ...}
 * Unlike /collecte/campaigns which returns name as plain String.
 */
@Serializable
private data class WorkflowCampaignDto(
    val id: String,
    val code: String? = null,
    val name: JsonElement? = null,
    val description: JsonElement? = null,
    val domain: String? = null,
    val status: String = "",
    val startDate: String? = null,
    val endDate: String? = null,
    val targetSubmissions: Int? = null,
    val tenantId: String? = null,
) {
    /** Extract localized name, preferring EN then FR. */
    fun nameString(): String {
        if (name == null) return code ?: ""
        return when (name) {
            is JsonPrimitive -> name.content
            else -> try {
                val obj = name.jsonObject
                obj["en"]?.jsonPrimitive?.content
                    ?: obj["fr"]?.jsonPrimitive?.content
                    ?: obj.values.firstOrNull()?.jsonPrimitive?.content
                    ?: code ?: ""
            } catch (_: Exception) { code ?: "" }
        }
    }

    fun descriptionString(): String? {
        if (description == null) return null
        return when (description) {
            is JsonPrimitive -> description.content
            else -> try {
                val obj = description.jsonObject
                obj["en"]?.jsonPrimitive?.content ?: obj["fr"]?.jsonPrimitive?.content
            } catch (_: Exception) { null }
        }
    }

    fun toCampaignDto(): CampaignDto = CampaignDto(
        id = id,
        tenantId = tenantId ?: "",
        name = nameString(),
        domain = domain ?: "",
        templateId = "",
        startDate = startDate ?: "",
        endDate = endDate ?: "",
        status = status,
        description = descriptionString(),
        targetSubmissions = targetSubmissions,
    )
}

class CampaignApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getActiveCampaigns(): ApiResponse<List<CampaignDto>> {
        return client.get("/api/v1/collecte/campaigns?status=ACTIVE").body()
    }

    /**
     * Get ALL campaigns for a domain (all statuses). Safe parsing.
     * Uses /api/v1/workflow/campaigns (same as web PlanningsSection)
     * with domain param in underscore format (animal_health, not animal-health).
     */
    suspend fun getAllCampaignsByDomain(domainCode: String): List<CampaignDto> {
        // Web uses underscores: animal-health → animal_health
        val underscoreDomain = domainCode.replace("-", "_")

        // Primary: workflow/campaigns (what web uses — has ALL statuses)
        val fromWorkflow = fetchCampaignsSafe("/api/v1/workflow/campaigns", "domain", underscoreDomain)
        if (fromWorkflow.isNotEmpty()) {
            Log.d(TAG, "Campaigns for $domainCode: ${fromWorkflow.size} from workflow (domain=$underscoreDomain)")
            return fromWorkflow
        }

        // Fallback: collecte/campaigns with both param styles
        val fromCollecte = fetchCampaignsSafe("/api/v1/collecte/campaigns", "domainCode", domainCode)
        val fromLegacy = fetchCampaignsSafe("/api/v1/collecte/campaigns", "domain", domainCode)
        val merged = (fromCollecte + fromLegacy).distinctBy { it.id }
        Log.d(TAG, "Campaigns for $domainCode: ${fromCollecte.size} collecte + ${fromLegacy.size} legacy = ${merged.size} merged")
        return merged
    }

    /** Get campaigns filtered by sub-domain code. */
    suspend fun getCampaignsBySubDomain(domainCode: String, subDomainCode: String): List<CampaignDto> {
        val underscoreDomain = domainCode.replace("-", "_")
        // Try workflow first (has all statuses)
        val fromWorkflow = fetchCampaignsSafeWithSub("/api/v1/workflow/campaigns", underscoreDomain, subDomainCode)
        if (fromWorkflow.isNotEmpty()) {
            Log.d(TAG, "SubDomain campaigns: ${fromWorkflow.size} from workflow ($underscoreDomain/$subDomainCode)")
            return fromWorkflow
        }
        // Fallback collecte
        val fromCollecte = fetchCampaignsSafeWithSub("/api/v1/collecte/campaigns", domainCode, subDomainCode)
        Log.d(TAG, "SubDomain campaigns: ${fromCollecte.size} from collecte ($domainCode/$subDomainCode)")
        return fromCollecte
    }

    private suspend fun fetchCampaignsSafeWithSub(endpoint: String, domain: String, subDomainCode: String): List<CampaignDto> {
        return try {
            val response = client.get(endpoint) {
                parameter("domain", domain)
                parameter("subDomainCode", subDomainCode)
                parameter("limit", 50)
            }
            if (response.status.value !in 200..299) return emptyList()
            if (endpoint.contains("/workflow/")) {
                val body: SafeApiResponse<List<WorkflowCampaignDto>> = response.body()
                (body.data ?: emptyList()).map { it.toCampaignDto() }
            } else {
                val body: SafeApiResponse<List<CampaignDto>> = response.body()
                body.data ?: emptyList()
            }
        } catch (e: Exception) {
            Log.w(TAG, "fetchSubDomain $endpoint failed: ${e.message}")
            emptyList()
        }
    }

    private suspend fun fetchCampaignsSafe(endpoint: String, paramName: String, value: String): List<CampaignDto> {
        return try {
            val response = client.get(endpoint) {
                parameter(paramName, value)
                parameter("limit", 50)
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "fetchCampaigns $endpoint?$paramName=$value → HTTP ${response.status.value}")
                return emptyList()
            }

            if (endpoint.contains("/workflow/")) {
                // Workflow endpoint returns name as JSON object {en, fr}
                val body: SafeApiResponse<List<WorkflowCampaignDto>> = response.body()
                val result = (body.data ?: emptyList()).map { it.toCampaignDto() }
                Log.d(TAG, "fetchWorkflow $paramName=$value → ${result.size} campaigns")
                result
            } else {
                // Collecte endpoint returns name as plain String
                val body: SafeApiResponse<List<CampaignDto>> = response.body()
                body.data ?: emptyList()
            }
        } catch (e: Exception) {
            Log.w(TAG, "fetchCampaigns $endpoint?$paramName=$value failed: ${e.message}")
            Log.w(TAG, "JSON input: ...${e.message?.takeLast(80)}...")
            emptyList()
        }
    }

    suspend fun getCampaignDetail(campaignId: String): ApiResponse<CampaignDetailDto> {
        return client.get("/api/v1/collecte/campaigns/$campaignId").body()
    }

    suspend fun getFormTemplate(templateId: String): FormTemplateDto? {
        if (templateId.isBlank()) return null
        return try {
            val response = client.get("/api/v1/form-builder/templates/$templateId")
            if (response.status.value !in 200..299) {
                Log.w(TAG, "getFormTemplate $templateId → HTTP ${response.status.value}")
                return null
            }
            // schema/uiSchema come as JSON objects from API, not strings
            val body: SafeApiResponse<RawFormTemplateDto> = response.body()
            val raw = body.data ?: return null
            Log.d(TAG, "getFormTemplate OK: ${raw.name} (schema ${raw.schema?.toString()?.take(50)}...)")
            raw.toFormTemplateDto()
        } catch (e: Exception) {
            Log.w(TAG, "getFormTemplate $templateId failed: ${e.message}")
            null
        }
    }

    suspend fun getFormTemplateInfo(templateId: String): TemplateInfoDto? {
        if (templateId.isBlank()) return null
        return try {
            val response = client.get("/api/v1/form-builder/templates/$templateId")
            if (response.status.value !in 200..299) return null
            val body: SafeApiResponse<TemplateInfoDto> = response.body()
            body.data
        } catch (e: Exception) {
            Log.w(TAG, "getFormTemplateInfo $templateId failed: ${e.message}")
            null
        }
    }

    /** List published form templates for a domain. Safe parsing. */
    suspend fun getPublishedTemplatesSafe(domain: String): List<FormTemplateSummaryDto> {
        return try {
            val response = client.get("/api/v1/form-builder/templates") {
                parameter("domain", domain)
                parameter("status", "PUBLISHED")
                parameter("limit", 20)
            }
            if (response.status.value !in 200..299) return emptyList()
            val body: SafeApiResponse<List<FormTemplateSummaryDto>> = response.body()
            body.data ?: emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch templates for $domain: ${e.message}")
            emptyList()
        }
    }

    /** List sub-domains for a domain code. Safe parsing. */
    suspend fun getSubDomains(domainCode: String): List<org.auibar.aris.mobile.data.remote.dto.SubDomainDto> {
        return try {
            val response = client.get("/api/v1/credential/domains/$domainCode/sub-domains")
            if (response.status.value !in 200..299) {
                Log.w(TAG, "Sub-domains API returned ${response.status.value} for $domainCode")
                return emptyList()
            }
            val body: SafeApiResponse<List<org.auibar.aris.mobile.data.remote.dto.SubDomainDto>> = response.body()
            body.data ?: emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch sub-domains for $domainCode: ${e.message}")
            emptyList()
        }
    }

    /** Load reference data options for form select fields via /ref/{type}/for-select. */
    suspend fun getRefDataForSelect(type: String): List<RefDataSelectItem> {
        return try {
            val response = client.get("/api/v1/master-data/ref/$type/for-select")
            if (response.status.value !in 200..299) {
                Log.w(TAG, "Ref data $type → HTTP ${response.status.value}")
                return emptyList()
            }
            val body: SafeApiResponse<List<RefDataSelectItem>> = response.body()
            body.data ?: emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "Ref data $type failed: ${e.message}")
            emptyList()
        }
    }
}

@Serializable
data class RefDataSelectItem(
    val id: String,
    val code: String? = null,
    val label: String? = null,
    val labelEn: String? = null,
    val labelFr: String? = null,
    val name: String? = null,
    val commonName: String? = null,
    val scientificName: String? = null,
)
