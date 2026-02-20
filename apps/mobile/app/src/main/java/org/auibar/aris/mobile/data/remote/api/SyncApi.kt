package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.DiseaseDto
import org.auibar.aris.mobile.data.remote.dto.GeoDto
import org.auibar.aris.mobile.data.remote.dto.SpeciesDto
import org.auibar.aris.mobile.data.remote.dto.SyncRequest
import org.auibar.aris.mobile.data.remote.dto.SyncResponse
import javax.inject.Inject

class SyncApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun sync(request: SyncRequest): ApiResponse<SyncResponse> {
        return client.post("/api/v1/collecte/sync") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun fetchSpecies(): ApiResponse<List<SpeciesDto>> {
        return client.get("/api/v1/master-data/species").body()
    }

    suspend fun fetchDiseases(): ApiResponse<List<DiseaseDto>> {
        return client.get("/api/v1/master-data/diseases").body()
    }

    suspend fun fetchGeoUnits(): ApiResponse<List<GeoDto>> {
        return client.get("/api/v1/master-data/geo-units").body()
    }
}
