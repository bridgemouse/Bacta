package io.github.bridgemouse.bacta.ui.briefing

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertIs
import org.junit.Test

class BriefingMappingTest {
    private val now = Instant.parse("2026-11-03T15:00:00Z")
    private val clock = Clock.fixed(now, ZoneId.of("America/New_York"))

    private fun briefing(age: Duration, summary: String? = "S", body: String = "B", rec: String = "R") = Briefing(
        tone = Tone.Positive, headline = "H", summary = summary, body = body, recommendation = rec,
        flags = emptyList(), generatedAt = now.minus(age), model = null,
    )

    @Test
    fun freshBriefingIsLiveWithALocalTimestamp() {
        val state = briefingState(Result.success(briefing(Duration.ofHours(1))), last = null, clock = clock)
        val live = assertIs<BriefingState.Live>(state)
        assertEquals("NOV 3 · 09:00", live.timestamp)
        assertEquals(BriefingContent(Tone.Positive, "H", "S", "R"), live.content)
    }

    @Test
    fun summaryFallsBackToTheBodyAndBlankFieldsBecomeNull() {
        val state = briefingState(Result.success(briefing(Duration.ofHours(1), summary = null, body = "Body", rec = " ")), null, clock)
        val content = assertIs<BriefingState.Live>(state).content
        assertEquals("Body", content.summary)
        assertEquals(null, content.directive)
    }

    @Test
    fun staleBriefingCarriesItsAge() {
        val hours = briefingState(Result.success(briefing(Duration.ofHours(40))), null, clock)
        assertEquals("40h ago", assertIs<BriefingState.Stale>(hours).age)
        val days = briefingState(Result.success(briefing(Duration.ofHours(75))), null, clock)
        assertEquals("3d ago", assertIs<BriefingState.Stale>(days).age)
    }

    @Test
    fun serverPlaceholderIsNoBriefing() {
        assertEquals(BriefingState.NoBriefing, briefingState(Result.success(null), null, clock))
    }

    @Test
    fun networkFailureIsOfflineAndKeepsTheLastBriefing() {
        val last = briefing(Duration.ofHours(5))
        val offline = assertIs<BriefingState.Offline>(briefingState(Result.failure(IOException("down")), last, clock))
        assertEquals("H", offline.last?.headline)
        assertEquals("5h ago", offline.age)
        assertEquals(BriefingState.Offline(null, null), briefingState(Result.failure(IOException("down")), null, clock))
    }

    @Test
    fun otherFailuresAreErrorsNotOffline() {
        assertEquals(BriefingState.Error, briefingState(Result.failure(IllegalStateException("500")), null, clock))
    }
}
