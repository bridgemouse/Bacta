package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BriefingDto
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone
import java.io.IOException
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Test

class BriefingRepositoryTest {
    private val api = FakeBactaApi()
    private val repo = DefaultBriefingRepository(api)

    private fun dto(generatedAt: String?, tone: String = "POSITIVE") = BriefingDto(
        tone = tone, headline = "H", summary = "S", body = "B", recommendation = "R",
        flags = listOf(JsonPrimitive("f1")), generatedAt = generatedAt, model = "m",
    )

    @Test
    fun briefingWithoutGeneratedAtIsNull() = runTest {
        api.briefingHandler = { dto(null) }
        assertNull(repo.briefing(Section.Home).getOrThrow())
    }

    @Test
    fun briefingWithGeneratedAtMapsAllFields() = runTest {
        var asked = ""
        api.briefingHandler = { asked = it; dto("2026-11-03T11:00:00Z", tone = "flag") }
        val b = repo.briefing(Section.Recovery).getOrThrow()!!
        assertEquals("recovery", asked)
        assertEquals(Tone.Flag, b.tone)
        assertEquals("H", b.headline)
        assertEquals("S", b.summary)
        assertEquals("B", b.body)
        assertEquals("R", b.recommendation)
        assertEquals(listOf("f1"), b.flags)
        assertEquals(Instant.parse("2026-11-03T11:00:00Z"), b.generatedAt)
        assertEquals("m", b.model)
    }

    @Test
    fun anUnparseableTimestampIsNotTrustedAsLive() = runTest {
        api.briefingHandler = { dto("yesterday-ish") }
        assertNull(repo.briefing(Section.Home).getOrThrow())
    }

    @Test
    fun failureIsAResult() = runTest {
        api.briefingHandler = { throw IOException("down") }
        assertTrue(repo.briefing(Section.Home).isFailure)
    }
}
