package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.ApiMeta
import org.auibar.aris.mobile.data.remote.dto.DiseaseDto
import org.auibar.aris.mobile.data.remote.dto.GeoDto
import org.auibar.aris.mobile.data.remote.dto.SpeciesDto
import org.auibar.aris.mobile.data.remote.dto.SyncRequest
import org.auibar.aris.mobile.data.remote.dto.SyncResponse
import javax.inject.Inject

class SyncApi @Inject constructor(
    private val client: HttpClient,
) {
    companion object {
        private const val TAG = "SyncApi"
        /** Backend MAX_LIMIT is 100, so we paginate with that page size. */
        private const val PAGE_SIZE = 100
    }

    suspend fun sync(request: SyncRequest): SafeApiResponse<SyncResponse> {
        return client.post("/api/v1/collecte/sync") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    /** Fetch ALL species by paginating through the backend (MAX_LIMIT=100). */
    suspend fun fetchAllSpecies(): List<SpeciesDto> {
        return fetchAllPages { page ->
            client.get("/api/v1/master-data/species") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }.body<SafeApiResponse<List<SpeciesDto>>>()
        }
    }

    /** Fetch ALL diseases by paginating through the backend (MAX_LIMIT=100). */
    suspend fun fetchAllDiseases(): List<DiseaseDto> {
        return fetchAllPages { page ->
            client.get("/api/v1/master-data/diseases") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }.body<SafeApiResponse<List<DiseaseDto>>>()
        }
    }

    /** Fetch ALL geo units by paginating through the backend (MAX_LIMIT=100). */
    suspend fun fetchAllGeoUnits(): List<GeoDto> {
        return fetchAllPages { page ->
            client.get("/api/v1/master-data/geo") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }.body<SafeApiResponse<List<GeoDto>>>()
        }
    }

    /**
     * Generic pagination helper: keeps fetching pages until all data is retrieved.
     * Uses SafeApiResponse to handle error responses gracefully.
     */
    private suspend fun <T> fetchAllPages(
        fetcher: suspend (page: Int) -> SafeApiResponse<List<T>>,
    ): List<T> {
        val allItems = mutableListOf<T>()
        var page = 1
        while (true) {
            val response = fetcher(page)
            val items = response.data ?: break
            allItems.addAll(items)
            val total = response.meta?.total ?: items.size
            Log.d(TAG, "Page $page: ${items.size} items (total: $total, accumulated: ${allItems.size})")
            if (allItems.size >= total || items.size < PAGE_SIZE) break
            page++
        }
        return allItems
    }
}
