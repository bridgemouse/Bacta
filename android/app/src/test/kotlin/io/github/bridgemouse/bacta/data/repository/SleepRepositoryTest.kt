package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.HypnoDto
import io.github.bridgemouse.bacta.domain.SleepStage
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import org.junit.Test

class SleepRepositoryTest {
    private val api = FakeBactaApi()
    private val repo = DefaultSleepRepository(api)

    @Test
    fun aFullHypnogramMapsLevelsToStages() = runTest {
        api.hypnoHandler = { HypnoDto(List(24) { if (it < 12) 3 else 2 }, startLocal = 1000L, endLocal = 9000L) }
        val h = repo.hypnogram().getOrThrow()!!
        assertEquals(24, h.levels.size)
        assertEquals(SleepStage.Deep, h.levels.first())
        assertEquals(SleepStage.Light, h.levels.last())
        assertEquals(1000L, h.startLocalMs)
    }

    @Test
    fun anEmptyOrWrongSizedHypnogramMeansNone() = runTest {
        api.hypnoHandler = { HypnoDto(emptyList(), null, null) }
        assertNull(repo.hypnogram().getOrThrow())
        api.hypnoHandler = { HypnoDto(List(10) { 1 }, 1L, 2L) }
        assertNull(repo.hypnogram().getOrThrow())
    }

    @Test
    fun unknownLevelsBecomeGapsAndAnAllGapNightIsNone() = runTest {
        api.hypnoHandler = { HypnoDto(List(24) { if (it == 0) 3 else 9 }, 1L, 2L) }
        assertNull(repo.hypnogram().getOrThrow()!!.levels[1])
        api.hypnoHandler = { HypnoDto(List(24) { 9 }, 1L, 2L) }
        assertNull(repo.hypnogram().getOrThrow())
    }

    @Test
    fun failureIsAResult() = runTest {
        api.hypnoHandler = { throw IOException("down") }
        assertTrue(repo.hypnogram().isFailure)
    }
}
