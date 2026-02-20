package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import javax.inject.Inject

class CampaignApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getActiveCampaigns(): ApiResponse<List<CampaignDto>> {
        return client.get("/api/v1/collecte/campaigns?status=ACTIVE").body()
    }
}
