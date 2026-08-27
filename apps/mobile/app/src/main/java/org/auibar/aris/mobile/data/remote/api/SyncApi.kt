package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
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
        return fetchAllPages("species") { page ->
            client.get("/api/v1/master-data/species") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }
        }
    }

    /** Fetch ALL diseases by paginating through the backend (MAX_LIMIT=100). */
    suspend fun fetchAllDiseases(): List<DiseaseDto> {
        return fetchAllPages("diseases") { page ->
            client.get("/api/v1/master-data/diseases") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }
        }
    }

    /** Fetch ALL geo units by paginating through the backend (MAX_LIMIT=100). */
    suspend fun fetchAllGeoUnits(): List<GeoDto> {
        return fetchAllPages("geo") { page ->
            client.get("/api/v1/master-data/geo") {
                parameter("page", page)
                parameter("limit", PAGE_SIZE)
            }
        }
    }

    /**
     * Generic pagination helper: keeps fetching pages until all data is retrieved.
     * Checks HTTP status before parsing JSON to avoid "unexpected JSON token" errors.
     */
    private suspend inline fun <reified T> fetchAllPages(
        label: String,
        crossinline fetcher: suspend (page: Int) -> HttpResponse,
    ): List<T> {
        val allItems = mutableListOf<T>()
        var page = 1
        while (true) {
            val httpResponse = fetcher(page)
            if (httpResponse.status.value !in 200..299) {
                Log.w(TAG, "$label page $page → HTTP ${httpResponse.status.value}, stopping pagination")
                break
            }
            val response: SafeApiResponse<List<T>> = httpResponse.body()
            val items = response.data ?: break
            allItems.addAll(items)
            val total = response.meta?.total ?: items.size
            Log.d(TAG, "$label page $page: ${items.size} items (total: $total, accumulated: ${allItems.size})")
            if (allItems.size >= total || items.size < PAGE_SIZE) break
            page++
        }
        return allItems
    }
}
