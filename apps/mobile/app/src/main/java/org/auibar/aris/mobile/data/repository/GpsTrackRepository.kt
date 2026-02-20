package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.entity.GpsTrackEntity
import java.util.UUID
import javax.inject.Inject

data class GpsTrack(
    val id: String,
    val submissionId: String?,
    val campaignId: String?,
    val geoJson: String,
    val pointCount: Int,
    val distanceMeters: Double,
    val startedAt: Long,
    val stoppedAt: Long?,
    val status: String,
)

class GpsTrackRepository @Inject constructor(
    private val gpsTrackDao: GpsTrackDao,
) {
    fun getAll(): Flow<List<GpsTrack>> {
        return gpsTrackDao.getAll().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getBySubmission(submissionId: String): Flow<List<GpsTrack>> {
        return gpsTrackDao.getBySubmission(submissionId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun observeActiveTrack(): Flow<GpsTrack?> {
        return gpsTrackDao.observeActiveTrack().map { it?.toDomain() }
    }

    suspend fun getActiveTrack(): GpsTrack? =
        gpsTrackDao.getActiveTrack()?.toDomain()

    suspend fun startTrack(campaignId: String?): String {
        val id = UUID.randomUUID().toString()
        val emptyGeoJson = """{"type":"LineString","coordinates":[]}"""
        val entity = GpsTrackEntity(
            id = id,
            submissionId = null,
            campaignId = campaignId,
            geoJson = emptyGeoJson,
            pointCount = 0,
            distanceMeters = 0.0,
            startedAt = System.currentTimeMillis(),
            stoppedAt = null,
            status = "RECORDING",
        )
        gpsTrackDao.insert(entity)
        return id
    }

    suspend fun addPoint(trackId: String, lat: Double, lng: Double): Int {
        val track = gpsTrackDao.getById(trackId) ?: return 0
        val coordinates = parseCoordinates(track.geoJson).toMutableList()
        val newPoint = doubleArrayOf(lng, lat)  // GeoJSON is [lng, lat]
        val distance = if (coordinates.isNotEmpty()) {
            val last = coordinates.last()
            track.distanceMeters + haversineDistance(last[1], last[0], lat, lng)
        } else {
            0.0
        }
        coordinates.add(newPoint)
        val geoJson = buildGeoJson(coordinates)
        gpsTrackDao.updateTrackData(trackId, geoJson, coordinates.size, distance)
        return coordinates.size
    }

    suspend fun stopTrack(trackId: String) {
        gpsTrackDao.stopTrack(trackId, "COMPLETED", System.currentTimeMillis())
    }

    suspend fun attachToSubmission(trackId: String, submissionId: String) {
        gpsTrackDao.attachToSubmission(trackId, submissionId)
    }

    private fun parseCoordinates(geoJson: String): List<DoubleArray> {
        // Simple JSON parsing for coordinates array
        val coordsStart = geoJson.indexOf("\"coordinates\":")
        if (coordsStart == -1) return emptyList()
        val arrayStart = geoJson.indexOf("[[", coordsStart)
        if (arrayStart == -1) return emptyList()
        val arrayEnd = geoJson.indexOf("]]", arrayStart)
        if (arrayEnd == -1) return emptyList()
        val coordsStr = geoJson.substring(arrayStart + 1, arrayEnd + 1)
        return coordsStr.split("],[").map { pair ->
            val clean = pair.removePrefix("[").removeSuffix("]")
            val parts = clean.split(",")
            if (parts.size >= 2) {
                doubleArrayOf(parts[0].trim().toDouble(), parts[1].trim().toDouble())
            } else {
                doubleArrayOf(0.0, 0.0)
            }
        }
    }

    private fun buildGeoJson(coordinates: List<DoubleArray>): String {
        val coordStr = coordinates.joinToString(",") { "[${it[0]},${it[1]}]" }
        return """{"type":"LineString","coordinates":[$coordStr]}"""
    }

    companion object {
        /**
         * Haversine formula to calculate distance between two GPS coordinates in meters.
         */
        fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val r = 6371000.0 // Earth radius in meters
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
            val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            return r * c
        }
    }

    private fun GpsTrackEntity.toDomain() = GpsTrack(
        id = id,
        submissionId = submissionId,
        campaignId = campaignId,
        geoJson = geoJson,
        pointCount = pointCount,
        distanceMeters = distanceMeters,
        startedAt = startedAt,
        stoppedAt = stoppedAt,
        status = status,
    )
}
