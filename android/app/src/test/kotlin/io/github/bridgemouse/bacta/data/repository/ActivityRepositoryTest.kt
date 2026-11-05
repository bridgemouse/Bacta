package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.ActivitiesDto
import io.github.bridgemouse.bacta.data.network.ActivityDto
import io.github.bridgemouse.bacta.data.network.BactaJson
import io.github.bridgemouse.bacta.data.network.IntensityDto
import io.github.bridgemouse.bacta.data.network.WeekDto
import io.github.bridgemouse.bacta.data.network.WeeksDto
import java.io.IOException
import java.time.LocalDateTime
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.decodeFromString
import org.junit.Test

class ActivityRepositoryTest {
    private val api = FakeBactaApi()
    private val repo = DefaultActivityRepository(api)
    private fun fixture(name: String) = checkNotNull(javaClass.getResource("/fixtures/$name")).readText()

    @Test
    fun activitiesDecodeFixtureAndMapToDomain() = runTest {
        var asked = 0
        api.activitiesHandler = { asked = it; BactaJson.decodeFromString<ActivitiesDto>(fixture("activities.json")) }
        val list = repo.activities(8).getOrThrow()
        assertEquals(8, asked)
        assertEquals(2, list.size)
        val run = list[0]
        assertEquals("1001", run.id)
        assertEquals("running", run.typeKey)
        assertEquals("Synthetic Morning Run", run.name)
        assertEquals(LocalDateTime.of(2026, 11, 3, 7, 15, 0), run.start)
        assertEquals(1800.0, run.durationSeconds)
        assertEquals(151, run.avgHr)
        assertEquals(420, run.calories)
    }

    @Test
    fun partialActivitiesKeepNullsAndAnUnparseableStartIsDropped() = runTest {
        api.activitiesHandler = {
            ActivitiesDto(
                listOf(
                    BactaJson.decodeFromString<ActivityDto>("""{"activity_id":"1","date":"2026-11-03","start_time":"2026-11-03 07:00:00","type_key":"x"}"""),
                    BactaJson.decodeFromString<ActivityDto>("""{"activity_id":"2","date":"2026-11-03","start_time":"not a time","type_key":"x"}"""),
                ),
            )
        }
        val list = repo.activities(7).getOrThrow()
        assertEquals(listOf("1"), list.map { it.id })
        assertNull(list.single().durationSeconds)
        assertNull(list.single().avgHr)
    }

    @Test
    fun oneWeeklyCallFailingDoesNotFailTheOthers() = runTest {
        api.weeklyVolumeHandler = { throw IOException("down") }
        api.weeklyAvgHrHandler = { WeeksDto(listOf(WeekDto("2026-44", avgHr = 151.0))) }
        api.weeklyIntensityHandler = { IntensityDto(95.0, 20.0) }
        assertTrue(repo.weeklyVolume(6).isFailure)
        assertEquals(listOf(WeekValue("2026-44", 151.0)), repo.weeklyAvgHr(6).getOrThrow())
        assertEquals(WeeklyIntensity(95.0, 20.0), repo.weeklyIntensity().getOrThrow())
    }
}
