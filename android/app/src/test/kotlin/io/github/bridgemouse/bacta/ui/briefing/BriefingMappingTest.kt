package io.github.bridgemouse.bacta.ui.briefing

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
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

private fun briefingState(r: Result<Briefing?>, last: Briefing?, clock: Clock) =
    io.github.bridgemouse.bacta.ui.briefing.briefingState(r, last, clock, testFormatters)

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
        val stamp = live.timestamp.s()!!
        assertEquals(true, "9:00" in stamp && stamp.contains("AM", ignoreCase = true), stamp)
        assertEquals(BriefingContent(Tone.Positive, "H", "S", "R", body = "B"), live.content)
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
        assertEquals("40h ago", assertIs<BriefingState.Stale>(hours).age.s())
        val days = briefingState(Result.success(briefing(Duration.ofHours(75))), null, clock)
        assertEquals("3d ago", assertIs<BriefingState.Stale>(days).age.s())
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
        assertEquals("5h ago", offline.age.s())
        assertEquals(BriefingState.Offline(null, null), briefingState(Result.failure(IOException("down")), null, clock))
    }

    @Test
    fun otherFailuresAreErrorsNotOffline() {
        assertEquals(BriefingState.Error, briefingState(Result.failure(IllegalStateException("500")), null, clock))
    }

    @Test
    fun theFullAnalysisIsOnlyKeptWhenThereIsASeparateSummary() {
        fun content(summary: String?, body: String) =
            assertIs<BriefingState.Live>(briefingState(Result.success(briefing(Duration.ofHours(1), summary = summary, body = body)), null, clock)).content
        assertEquals("B", content("S", "B").body)
        assertEquals(null, content(null, "B").body)
        assertEquals("B", content(null, "B").summary)
        assertEquals(null, content("S", "  ").body)
    }

    @Test
    fun flagsAreCarriedToTheContent() {
        val b = briefing(Duration.ofHours(1)).copy(flags = listOf("first flag", "second flag"))
        val live = assertIs<BriefingState.Live>(briefingState(Result.success(b), null, clock))
        assertEquals(listOf("first flag", "second flag"), live.content.flags)
    }
}
