package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

private fun toTiles(s: Summary, t: Map<Metric, Result<List<Double>>>) = io.github.bridgemouse.bacta.ui.home.toTiles(s, t, testFormatters)
private fun toTrendRows(s: Summary, t: Map<Metric, Result<List<Double>>>) = io.github.bridgemouse.bacta.ui.home.toTrendRows(s, t, testFormatters)

class HomeMappingTest {
    private val failed: Map<Metric, Result<List<Double>>> = Metric.entries.associateWith { Result.failure(IOException("x")) }
    private fun ok(vararg v: Pair<Metric, List<Double>>): Map<Metric, Result<List<Double>>> =
        failed + v.associate { (m, s) -> m to Result.success(s) }

    @Test
    fun allMetricsMissingShowsDashesNotFakeNumbers() {
        val tiles = toTiles(Summary(), failed)
        assertTrue(tiles.all { it.value == null && it.trend == null && it.ring == null })
        val text = tiles.joinToString { "${it.value.s()}${it.sub.s()}${it.unit.s()}" }
        listOf("74", "82", "342").forEach { assertTrue(it !in text, "found $it") }
        assertTrue(toTrendRows(Summary(), failed).all { it.value == null && it.series.isEmpty() && it.delta == null })
    }

    @Test
    fun everyTileCarriesItsSectionIcon() {
        val tiles = toTiles(Summary(), failed)
        assertEquals(listOf(io.github.bridgemouse.bacta.domain.Section.Recovery, io.github.bridgemouse.bacta.domain.Section.Training, io.github.bridgemouse.bacta.domain.Section.Sleep).map { io.github.bridgemouse.bacta.ui.designsystem.SectionIcons.of(it) }, tiles.map { it.icon })
    }

    @Test
    fun tilesAreRecoveryTrainingSleepOnly() {
        assertEquals(listOf("Recovery", "Training", "Sleep"), toTiles(Summary(), failed).map { it.label.s() })
    }

    @Test
    fun tilesMapRealValues() {
        val s = Summary(
            bodyBatteryCurrent = 64.0, hrv = 61.0, hrvWeekAvg = 58.0,
            trainingLoad = 410.4, trainingStatusN = 4.0, sleepSeconds = 27120.0, sleepScore = 81.0,
        )
        val (recovery, training, sleep) = toTiles(s, failed)
        assertEquals("64", recovery.value.s())
        assertEquals("battery", recovery.unit.s())
        assertEquals("HRV ↑ 61 ms", recovery.sub.s())
        assertEquals("410", training.value.s())
        assertEquals("Maintaining", training.sub.s())
        assertEquals("7h 32m", sleep.value.s())
        assertEquals(0.81f, sleep.ring)
        assertEquals("Score 81", sleep.sub.s())
    }

    @Test
    fun hrvSubHandlesBelowAverageNoAverageAndNoValue() {
        fun sub(hrv: Double?, avg: Double?) = toTiles(Summary(hrv = hrv, hrvWeekAvg = avg), failed).first().sub.s()
        assertEquals("HRV ↓ 61 ms", sub(61.0, 65.0))
        assertEquals("HRV 61 ms", sub(61.0, null))
        assertNull(sub(null, 65.0))
    }

    @Test
    fun sparklineIsRealTrendOrAbsent() {
        val tiles = toTiles(Summary(), ok(Metric.BodyBatteryCurrent to listOf(50.0, 60.0), Metric.TrainingLoad to listOf(300.0)))
        assertEquals(listOf(50.0, 60.0), tiles[0].trend)
        assertNull(tiles[1].trend)
        assertNull(tiles[2].trend)
    }


    @Test
    fun trendRowsCarryRealSeriesAndDeltas() {
        val s = Summary(recoveryScore = 75.0, hrv = 61.0, hrvWeekAvg = 58.0, sleepScore = 80.0, trainingLoad = 400.0)
        val rows = toTrendRows(
            s,
            ok(
                Metric.RecoveryScore to listOf(70.0, 72.0, 75.0),
                Metric.Hrv to listOf(55.0, 58.0, 61.0),
                Metric.SleepScore to listOf(82.0, 80.0),
                Metric.TrainingLoad to listOf(300.0, 400.0),
                Metric.IntensityMod to listOf(10.0, 20.0),
                Metric.IntensityVig to listOf(5.0, 5.0),
            ),
        )
        assertEquals(listOf("Recovery", "HRV", "Sleep", "Training Load", "Intensity"), rows.map { it.label.s() })
        assertEquals("75", rows[0].value)
        assertEquals("▲ 3", rows[0].delta?.text.s())
        assertEquals(DeltaDirection.Good, rows[0].delta?.direction)
        assertEquals("▲ 3", rows[1].delta?.text.s())
        assertEquals("▼ 2", rows[2].delta?.text.s())
        assertEquals(DeltaDirection.Bad, rows[2].delta?.direction)
        assertEquals(TrendKind.Bars, rows[3].kind)
        assertEquals(TrendKind.Bars, rows[4].kind)
        assertEquals(listOf(20.0, 30.0), rows[4].series)
        assertEquals("30", rows[4].value)
    }

    @Test
    fun intensityIsAbsentWhenTheTwoSeriesDoNotLineUp() {
        val row = toTrendRows(Summary(), ok(Metric.IntensityMod to listOf(1.0, 2.0, 3.0), Metric.IntensityVig to listOf(1.0))).last()
        assertTrue(row.series.isEmpty())
        assertNull(row.value)
    }

    @Test
    fun everyHomeTrendRowCarriesTheSeriesMean() {
        val week = listOf(2.0, 4.0, 6.0)
        val rows = toTrendRows(
            Summary(hrv = 61.0, hrvWeekAvg = 58.0),
            ok(Metric.RecoveryScore to week, Metric.Hrv to week, Metric.SleepScore to week, Metric.TrainingLoad to week, Metric.IntensityMod to week, Metric.IntensityVig to week),
        )
        assertEquals(listOf(4.0, 58.0, 4.0, 4.0, 12.0), rows.map { it.average })
    }

    @Test
    fun aSeriesTooShortToChartHasNoAverage() {
        val rows = toTrendRows(Summary(), ok(Metric.RecoveryScore to listOf(5.0), Metric.SleepScore to emptyList()))
        assertNull(rows[0].average)
        assertNull(rows[2].average)
    }
}
