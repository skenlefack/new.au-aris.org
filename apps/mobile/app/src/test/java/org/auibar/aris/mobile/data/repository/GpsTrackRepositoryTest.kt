package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.GpsTrackDao
import org.auibar.aris.mobile.data.local.entity.GpsTrackEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GpsTrackRepositoryTest {

    private lateinit var gpsTrackDao: GpsTrackDao
    private lateinit var repository: GpsTrackRepository

    @Before
    fun setup() {
        gpsTrackDao = mockk(relaxed = true)
        repository = GpsTrackRepository(gpsTrackDao)
    }

    @Test
    fun `haversineDistance returns 0 for same point`() {
        val distance = GpsTrackRepository.haversineDistance(0.0, 0.0, 0.0, 0.0)
        assertEquals(0.0, distance, 0.001)
    }

    @Test
    fun `haversineDistance calculates correct distance for known points`() {
        // Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ~ 343.5 km
        val distance = GpsTrackRepository.haversineDistance(
            48.8566, 2.3522,
            51.5074, -0.1278,
        )
        // Allow 1km tolerance
        assertTrue("Distance should be ~343km, was ${distance / 1000}km", distance > 340_000 && distance < 347_000)
    }

    @Test
    fun `haversineDistance returns positive value for any two different points`() {
        val distance = GpsTrackRepository.haversineDistance(
            -1.2921, 36.8219,   // Nairobi
            9.0579, 7.4951,     // Abuja
        )
        assertTrue(distance > 0)
    }

    @Test
    fun `startTrack creates new track with RECORDING status`() = runTest {
        val trackId = repository.startTrack("campaign-1")
        assertNotNull(trackId)
        assertTrue(trackId.isNotEmpty())

        coVerify {
            gpsTrackDao.insert(match { entity ->
                entity.status == "RECORDING" &&
                    entity.campaignId == "campaign-1" &&
                    entity.pointCount == 0 &&
                    entity.distanceMeters == 0.0 &&
                    entity.stoppedAt == null
            })
        }
    }

    @Test
    fun `startTrack with null campaignId`() = runTest {
        val trackId = repository.startTrack(null)
        assertNotNull(trackId)

        coVerify {
            gpsTrackDao.insert(match { entity ->
                entity.campaignId == null &&
                    entity.status == "RECORDING"
            })
        }
    }

    @Test
    fun `addPoint adds to existing track`() = runTest {
        val trackEntity = GpsTrackEntity(
            id = "track-1",
            submissionId = null,
            campaignId = null,
            geoJson = """{"type":"LineString","coordinates":[[36.8219,-1.2921]]}""",
            pointCount = 1,
            distanceMeters = 0.0,
            startedAt = System.currentTimeMillis(),
            stoppedAt = null,
            status = "RECORDING",
        )
        coEvery { gpsTrackDao.getById("track-1") } returns trackEntity

        val count = repository.addPoint("track-1", -1.2930, 36.8225)
        assertEquals(2, count)

        coVerify {
            gpsTrackDao.updateTrackData(
                "track-1",
                match { it.contains("36.8225") && it.contains("-1.293") },
                2,
                match { it > 0.0 },
            )
        }
    }

    @Test
    fun `addPoint returns 0 for non-existent track`() = runTest {
        coEvery { gpsTrackDao.getById("invalid") } returns null

        val count = repository.addPoint("invalid", 0.0, 0.0)
        assertEquals(0, count)
    }

    @Test
    fun `stopTrack calls dao with COMPLETED status`() = runTest {
        repository.stopTrack("track-1")

        coVerify {
            gpsTrackDao.stopTrack("track-1", "COMPLETED", any())
        }
    }

    @Test
    fun `attachToSubmission delegates to dao`() = runTest {
        repository.attachToSubmission("track-1", "submission-1")

        coVerify {
            gpsTrackDao.attachToSubmission("track-1", "submission-1")
        }
    }

    @Test
    fun `getActiveTrack returns null when no active track`() = runTest {
        coEvery { gpsTrackDao.getActiveTrack() } returns null

        val track = repository.getActiveTrack()
        assertNull(track)
    }

    @Test
    fun `getActiveTrack returns mapped domain model`() = runTest {
        val entity = GpsTrackEntity(
            id = "track-1",
            submissionId = null,
            campaignId = "camp-1",
            geoJson = """{"type":"LineString","coordinates":[[36.82,-1.29],[36.83,-1.30]]}""",
            pointCount = 2,
            distanceMeters = 150.0,
            startedAt = 1000L,
            stoppedAt = null,
            status = "RECORDING",
        )
        coEvery { gpsTrackDao.getActiveTrack() } returns entity

        val track = repository.getActiveTrack()
        assertNotNull(track)
        assertEquals("track-1", track!!.id)
        assertEquals("RECORDING", track.status)
        assertEquals(2, track.pointCount)
        assertEquals(150.0, track.distanceMeters, 0.001)
    }
}
