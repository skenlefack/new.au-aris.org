package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.CampaignDetailDto
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.remote.dto.TemplateInfoDto
import javax.inject.Inject

class CampaignApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getActiveCampaigns(): ApiResponse<List<CampaignDto>> {
        return client.get("/api/v1/collecte/campaigns?status=ACTIVE").body()
    }

    /** Get campaigns for a specific domain. */
    suspend fun getCampaignsByDomain(domain: String): ApiResponse<List<CampaignDto>> {
        return client.get("/api/v1/collecte/campaigns") {
            parameter("domain", domain)
            parameter("limit", 50)
        }.body()
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

    /** List published form templates for a domain. */
    suspend fun getPublishedTemplates(domain: String): ApiResponse<List<FormTemplateSummaryDto>> {
        return client.get("/api/v1/form-builder/templates") {
            parameter("domain", domain)
            parameter("status", "PUBLISHED")
            parameter("limit", 20)
        }.body()
    }
}
