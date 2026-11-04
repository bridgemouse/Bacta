package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.SummaryDto
import io.github.bridgemouse.bacta.data.network.TrendDto
import io.github.bridgemouse.bacta.data.network.TrendRowDto
import java.io.IOException
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.runTest
import org.junit.Test

class MetricsRepositoryTest {
    private val api = FakeBactaApi()
    private val repo = DefaultMetricsRepository(api)

    private fun rows(vararg v: Double) = TrendDto(v.mapIndexed { i, x -> TrendRowDto("2026-10-%02d".format(i + 1), x) })

    @Test
    fun summaryConvertsRecoveryTimeFromMinutesToHours() = runTest {
        api.summaryHandler = { SummaryDto(recoveryTimeH = 720.0, hrv = 61.0) }
        val summary = repo.summary().getOrThrow()
        assertEquals(12.0, summary.recoveryTimeHours)
        assertEquals(61.0, summary.hrv)
        assertNull(summary.sleepScore)
    }

    @Test
    fun sleepDurationPrefersTheTotalThenFallsBackToTheStageSum() = runTest {
        api.summaryHandler = { SummaryDto(sleepS = 27000.0, sleepDeepS = 1.0, sleepLightS = 1.0, sleepRemS = 1.0) }
        assertEquals(27000.0, repo.summary().getOrThrow().sleepSeconds)
        api.summaryHandler = { SummaryDto(sleepDeepS = 5000.0, sleepLightS = 15000.0, sleepRemS = 6000.0) }
        assertEquals(26000.0, repo.summary().getOrThrow().sleepSeconds)
    }

    @Test
    fun sleepDurationIsNullWhenAStageIsMissing() = runTest {
        api.summaryHandler = { SummaryDto(sleepDeepS = 5000.0, sleepLightS = 15000.0) }
        assertNull(repo.summary().getOrThrow().sleepSeconds)
    }

    @Test
    fun summaryFailureIsAResult() = runTest {
        api.summaryHandler = { throw IOException("down") }
        assertTrue(repo.summary().isFailure)
    }

    @Test
    fun trendsFetchesConcurrentlyAndIsolatesFailures() = runTest {
        val gate = CompletableDeferred<Unit>()
        var started = 0
        api.trendHandler = { metric, _, _ ->
            started++
            if (started == 3) gate.complete(Unit)
            gate.await()
            if (metric == "stress_avg") throw IOException("boom") else rows(1.0, 2.0)
        }

        val result = repo.trends(setOf(Metric.Hrv, Metric.StressAvg, Metric.RestingHr))

        assertEquals(listOf(1.0, 2.0), result.getValue(Metric.Hrv).getOrThrow())
        assertTrue(result.getValue(Metric.StressAvg).isFailure)
        assertEquals(listOf(1.0, 2.0), result.getValue(Metric.RestingHr).getOrThrow())
    }

    @Test
    fun trendRangeCoversExactlyTheRequestedDaysInclusive() = runTest {
        var range: Pair<String, String>? = null
        api.trendHandler = { _, from, to -> range = from to to; rows() }
        repo.trends(setOf(Metric.Hrv), days = 7, today = LocalDate.of(2026, 11, 3))
        assertEquals("2026-10-28" to "2026-11-03", range)
    }

    @Test
    fun trendRangeAcrossAYearBoundary() = runTest {
        var range: Pair<String, String>? = null
        api.trendHandler = { _, from, to -> range = from to to; rows() }
        repo.trends(setOf(Metric.Hrv), days = 7, today = LocalDate.of(2027, 1, 2))
        assertEquals("2026-12-27" to "2027-01-02", range)
    }

    @Test
    fun recoveryTimeTrendIsConvertedToHoursAndNullValuesDropped() = runTest {
        api.trendHandler = { _, _, _ ->
            TrendDto(listOf(TrendRowDto("2026-10-01", 120.0), TrendRowDto("2026-10-02", null), TrendRowDto("2026-10-03", 60.0)))
        }
        val result = repo.trends(setOf(Metric.RecoveryTime))
        assertEquals(listOf(2.0, 1.0), result.getValue(Metric.RecoveryTime).getOrThrow())
    }
}
