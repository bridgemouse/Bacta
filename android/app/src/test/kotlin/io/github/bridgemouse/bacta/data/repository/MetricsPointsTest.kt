package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.TrendDto
import io.github.bridgemouse.bacta.data.network.TrendRowDto
import java.io.IOException
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import org.junit.Test

class MetricsPointsTest {
    private val api = FakeBactaApi()
    private val repo = DefaultMetricsRepository(api)
    private val today = LocalDate.of(2026, 11, 3)

    @Test
    fun pointsKeepDatesAndDropNullValues() = runTest {
        api.trendHandler = { _, _, _ ->
            TrendDto(listOf(TrendRowDto("2026-11-01", 5.0), TrendRowDto("2026-11-02", null), TrendRowDto("2026-11-03", 7.5)))
        }
        val points = repo.points(setOf(Metric.Hrv), 7, today).getValue(Metric.Hrv).getOrThrow()
        assertEquals(listOf(TrendPoint(LocalDate.of(2026, 11, 1), 5.0), TrendPoint(LocalDate.of(2026, 11, 3), 7.5)), points)
    }

    @Test
    fun pointsApplyTheMetricsDisplayDivisor() = runTest {
        api.trendHandler = { _, _, _ -> TrendDto(listOf(TrendRowDto("2026-11-03", 27000.0))) }
        val p = repo.points(setOf(Metric.SleepSeconds), 7, today).getValue(Metric.SleepSeconds).getOrThrow()
        assertEquals(450.0, p.single().value)
    }

    @Test
    fun trendsStillReturnsPlainValues() = runTest {
        api.trendHandler = { _, _, _ -> TrendDto(listOf(TrendRowDto("2026-11-02", 1.0), TrendRowDto("2026-11-03", 2.0))) }
        assertEquals(listOf(1.0, 2.0), repo.trends(setOf(Metric.Hrv), 7, today).getValue(Metric.Hrv).getOrThrow())
    }

    @Test
    fun windowComesFromTheArgument() = runTest {
        val ranges = mutableListOf<Pair<String, String>>()
        api.trendHandler = { _, from, to -> ranges += from to to; TrendDto(emptyList()) }
        listOf(7, 14, 30).forEach { repo.points(setOf(Metric.Hrv), it, today) }
        assertEquals(listOf("2026-10-28" to "2026-11-03", "2026-10-21" to "2026-11-03", "2026-10-05" to "2026-11-03"), ranges)
    }

    @Test
    fun oneFailingMetricDoesNotFailTheOthers() = runTest {
        api.trendHandler = { m, _, _ -> if (m == "hrv") throw IOException("x") else TrendDto(listOf(TrendRowDto("2026-11-03", 1.0))) }
        val r = repo.points(setOf(Metric.Hrv, Metric.RestingHr), 7, today)
        assertTrue(r.getValue(Metric.Hrv).isFailure)
        assertEquals(1, r.getValue(Metric.RestingHr).getOrThrow().size)
    }
}
