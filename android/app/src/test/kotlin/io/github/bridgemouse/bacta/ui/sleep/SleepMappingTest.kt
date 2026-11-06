package io.github.bridgemouse.bacta.ui.sleep

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.NightHypnogram
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import java.io.IOException
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

private typealias Points = Map<Metric, Result<List<TrendPoint>>>

class SleepMappingTest {
    private val today = LocalDate.of(2026, 11, 4)
    private val failed: Points = Metric.entries.associateWith { Result.failure(IOException("x")) }
    private fun week(vararg v: Double, end: LocalDate = today): List<TrendPoint> =
        v.mapIndexed { i, x -> TrendPoint(end.minusDays((v.size - 1 - i).toLong()), x) }
    private fun ok(vararg p: Pair<Metric, List<TrendPoint>>): Points = failed + p.associate { (m, s) -> m to Result.success(s) }

    private val night = Summary(
        sleepSeconds = 27000.0, sleepDeepSeconds = 4800.0, sleepLightSeconds = 16800.0, sleepRemSeconds = 5400.0, sleepAwakeSeconds = 480.0,
        sleepScore = 92.0, sleepHr = 52.0, sleepResp = 14.0, sleepStress = 14.0, sleepSpo2 = 97.0,
    )

    private fun map(s: Summary, p: Points, h: NightHypnogram? = null, t: Targets = Targets.Default) =
        toSleepContent(s, p, h, t, testFormatters, today)

    @Test
    fun nullMetricsRenderDashesAndNoStages() {
        val c = map(Summary(), failed)
        assertNull(c.asleep); assertNull(c.inBed); assertNull(c.night)
        assertNull(c.score.value); assertNull(c.score.stateText); assertNull(c.score.tone)
        assertTrue(c.stages.isEmpty())
        assertNull(c.efficiency.value)
        assertNull(c.debt); assertNull(c.hypnogram); assertNull(c.architecture)
        assertTrue(c.vitals.isEmpty())
        assertTrue(c.trends.isEmpty())
    }

    @Test
    fun theHeroShowsAsleepInBedAndAGarminBand() {
        val c = map(night, failed)
        assertEquals("7h 30m", c.asleep.s())
        assertEquals("7h 38m in bed", c.inBed.s())
        assertEquals("92", c.score.valueText)
        assertEquals("EXCELLENT", c.score.stateText.s())
    }

    @Test
    fun stagesSumToOneHundred() {
        val c = map(night, failed)
        assertEquals(listOf(SleepStage.Deep, SleepStage.Light, SleepStage.Rem, SleepStage.Awake), c.stages.map { it.stage })
        assertEquals(100, c.stages.filter { it.stage != SleepStage.Awake }.sumOf { it.percent })
        assertEquals(listOf("1h 20m", "4h 40m", "1h 30m", "8m"), c.stages.map { it.minutes.s() })
    }

    @Test
    fun stagesAreAbsentWhenAnyStageIsMissing() {
        assertTrue(map(night.copy(sleepRemSeconds = null), failed).stages.isEmpty())
    }

    @Test
    fun efficiencyAndArchitectureUseTheDomainRules() {
        val c = map(night, failed)
        assertEquals("98%", c.efficiency.value.s())
        assertEquals(0.98f, c.efficiency.fraction)
        assertEquals("8m awake in bed", c.efficiency.caption.s())
        val arch = assertNotNull(c.architecture)
        assertEquals("92", arch.gauge.valueText)
        assertEquals(3, arch.parts.size)
    }

    @Test
    fun durationTrendUsesTotalSleepNotDeepSleep() {
        val total = week(420.0, 450.0, 480.0)
        val deep = week(60.0, 70.0, 80.0)
        val c = map(night, ok(Metric.SleepSeconds to total, Metric.SleepDeep to deep, Metric.SleepScore to week(80.0, 85.0)))
        val duration = c.trends.first { it.rail.s() == "DURATION" }
        assertEquals(listOf(420.0, 450.0, 480.0), duration.card.series)
        assertEquals(TrendKind.Bars, duration.card.kind)
    }

    @Test
    fun staleNightIsLabelled() {
        val fresh = map(night, ok(Metric.SleepScore to week(80.0, 90.0, end = today)))
        assertEquals(NightLabel(today, stale = false), fresh.night)
        val yesterday = map(night, ok(Metric.SleepScore to week(80.0, 90.0, end = today.minusDays(1))))
        assertEquals(false, yesterday.night?.stale)
        val old = map(night, ok(Metric.SleepScore to week(80.0, 90.0, end = today.minusDays(3))))
        assertEquals(NightLabel(today.minusDays(3), stale = true), old.night)
    }

    @Test
    fun vitalsOnlyThoseWithData() {
        assertEquals(listOf("Heart rate", "Respiration", "Sleep stress", "SpO₂"), map(night, failed).vitals.map { it.label.s() })
        val partial = map(night.copy(sleepHr = null, sleepSpo2 = null), failed)
        assertEquals(listOf("Respiration", "Sleep stress"), partial.vitals.map { it.label.s() })
    }

    @Test
    fun trendsHaveFiveSectionsFromSpecsWithRealDayLabels() {
        val all = Metric.entries.associateWith { Result.success(week(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)) }
        val c = map(night, all)
        assertEquals(listOf("DURATION", "SLEEP SCORE", "SLEEP HR", "RESPIRATION", "SLEEP STRESS"), c.trends.map { it.rail.s() })
        val labels = c.trends.first().card.dayLabels
        assertEquals(7, labels.size)
        assertEquals("Wed", labels.last())
    }

    @Test
    fun changingTheTrendWindowChangesTheCaption() {
        val c = toSleepContent(night, ok(Metric.SleepScore to week(1.0, 2.0)), null, Targets.Default.copy(trendDays = 14), testFormatters, today)
        assertEquals("14 days", c.trends.first().card.period.s())
    }

    @Test
    fun changingTheSleepTargetChangesDebt() {
        val nights = ok(Metric.SleepSeconds to week(400.0, 500.0, 460.0))
        val d480 = map(night, nights, t = Targets.Default.copy(sleepMinutes = 480)).debt!!
        val d420 = map(night, nights, t = Targets.Default.copy(sleepMinutes = 420)).debt!!
        assertEquals("1h 40m", d480.value.s())
        assertEquals("20m", d420.value.s())
        assertTrue(d480.fraction!! < 1f)
        assertEquals("ACCUMULATING OVER 7D", d480.caption.s())
    }

    @Test
    fun aMissingHypnogramOmitsTheCardAndAPresentOneCarriesLabels() {
        assertNull(map(night, failed, null).hypnogram)
        val h = NightHypnogram(List(24) { SleepStage.Light }, 1793746800000L, 1793775600000L)
        val model = assertNotNull(map(night, failed, h).hypnogram)
        assertEquals(24, model.levels.size)
        assertEquals(5, model.axisLabels.size)
    }
}
