package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.CampaignDetailDto
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.TemplateInfoDto
import javax.inject.Inject

private const val TAG = "CampaignApi"

class CampaignApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getActiveCampaigns(): ApiResponse<List<CampaignDto>> {
        return client.get("/api/v1/collecte/campaigns?status=ACTIVE").body()
    }

    /**
     * Get ALL campaigns for a domain (all statuses). Safe parsing.
     * Tries multi-target (domainCode) first, then legacy (domain) field.
     * Many planned/completed campaigns only have the legacy domain field set.
     */
    suspend fun getAllCampaignsByDomain(domainCode: String): List<CampaignDto> {
        // Try 1: modern multi-target filter (domainCode)
        val fromTargets = fetchCampaignsSafe("domainCode", domainCode)
        // Try 2: legacy domain field
        val fromLegacy = fetchCampaignsSafe("domain", domainCode)
        // Merge and deduplicate by id
        val merged = (fromTargets + fromLegacy).distinctBy { it.id }
        Log.d(TAG, "Campaigns for $domainCode: ${fromTargets.size} from targets + ${fromLegacy.size} from legacy = ${merged.size} merged")
        return merged
    }

    private suspend fun fetchCampaignsSafe(paramName: String, value: String): List<CampaignDto> {
        return try {
            val response = client.get("/api/v1/collecte/campaigns") {
                parameter(paramName, value)
                parameter("limit", 100)
            }
            if (response.status.value !in 200..299) return emptyList()
            val body: SafeApiResponse<List<CampaignDto>> = response.body()
            body.data ?: emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "fetchCampaignsSafe($paramName=$value) failed: ${e.message}")
            emptyList()
        }
    }

    suspend fun getCampaignDetail(campaignId: String): ApiResponse<CampaignDetailDto> {
        return client.get("/api/v1/collecte/campaigns/$campaignId").body()
    }

    suspend fun getFormTemplate(templateId: String): ApiResponse<FormTemplateDto> {
        return client.get("/api/v1/form-builder/templates/$templateId").body()
    }

    suspend fun getFormTemplateInfo(templateId: String): TemplateInfoDto {
        val response: ApiResponse<TemplateInfoDto> =
            client.get("/api/v1/form-builder/templates/$templateId").body()
        return response.data
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
}
