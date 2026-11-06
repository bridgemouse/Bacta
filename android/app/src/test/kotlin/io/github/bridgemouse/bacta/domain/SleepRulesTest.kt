package io.github.bridgemouse.bacta.domain

import io.github.bridgemouse.bacta.testFormatters
import java.util.TimeZone
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.junit.After
import org.junit.Test

class SleepRulesTest {
    private val originalZone = TimeZone.getDefault()

    @After fun restoreZone() = TimeZone.setDefault(originalZone)

    @Test
    fun scoreBandsFollowGarminsPublishedRangesOnBothSidesOfEachEdge() {
        assertEquals("Excellent", SleepRules.scoreBand(90.0)?.label)
        assertEquals("Good", SleepRules.scoreBand(89.0)?.label)
        assertEquals("Good", SleepRules.scoreBand(80.0)?.label)
        assertEquals("Fair", SleepRules.scoreBand(79.0)?.label)
        assertEquals("Fair", SleepRules.scoreBand(60.0)?.label)
        assertEquals("Poor", SleepRules.scoreBand(59.0)?.label)
        assertEquals("Poor", SleepRules.scoreBand(0.0)?.label)
        assertNull(SleepRules.scoreBand(null))
    }

    @Test
    fun debtClampsRestedNightsToZero() {
        assertEquals(80, SleepRules.debtMinutes(listOf(500, 400), targetMinutes = 480))
        assertEquals(0, SleepRules.debtMinutes(listOf(500, 520), targetMinutes = 480))
        assertEquals(0, SleepRules.debtMinutes(emptyList(), targetMinutes = 480))
    }

    @Test
    fun debtUsesTheTargetFromPreferences() {
        assertEquals(50, SleepRules.debtMinutes(listOf(500, 400), targetMinutes = 450))
        assertEquals(220, SleepRules.debtMinutes(listOf(500, 400), targetMinutes = 560))
    }

    @Test
    fun efficiencyHandlesZeroAndNull() {
        assertEquals(98, SleepRules.efficiencyPercent(asleepMin = 450, awakeMin = 8))
        assertEquals(100, SleepRules.efficiencyPercent(asleepMin = 400, awakeMin = 0))
        assertNull(SleepRules.efficiencyPercent(asleepMin = 0, awakeMin = 0))
    }

    @Test
    fun stagePercentsAlwaysSumToOneHundred() {
        listOf(Triple(80, 280, 90), Triple(1, 1, 1), Triple(100, 100, 100), Triple(33, 33, 34), Triple(0, 10, 0), Triple(7, 7, 7)).forEach { (d, l, r) ->
            assertEquals(100, SleepRules.stagePercents(d, l, r).sum(), "for $d/$l/$r")
        }
        assertEquals(listOf(18, 62, 20), SleepRules.stagePercents(80, 280, 90))
        assertEquals(listOf(0, 0, 0), SleepRules.stagePercents(0, 0, 0))
    }

    @Test
    fun architectureMatchesTheDocumentedFormula() {
        val a = assertNotNull(SleepRules.architecture(deepMin = 80, remMin = 90, awakeMin = 8, totalMin = 450))
        assertEquals(92, a.score)
        assertEquals(true, a.deepScore in 0.88..0.90)
        assertEquals(true, a.remScore in 0.90..0.92)
        assertEquals(1.0, a.awakeScore)
        assertNull(SleepRules.architecture(deepMin = 0, remMin = 0, awakeMin = 0, totalMin = 0))
    }

    @Test
    fun architectureCapsEachComponentAndPenalisesLongWakefulness() {
        val perfect = assertNotNull(SleepRules.architecture(deepMin = 200, remMin = 200, awakeMin = 0, totalMin = 400))
        assertEquals(100, perfect.score)
        val restless = assertNotNull(SleepRules.architecture(deepMin = 80, remMin = 88, awakeMin = 60, totalMin = 400))
        assertEquals(true, restless.awakeScore < 1.0)
        assertEquals(true, restless.score < 100)
    }

    @Test
    fun architectureTargetsAreParameters() {
        val strict = ArchitectureTargets(deepShare = 0.30, remShare = 0.30, awakeShare = 0.05)
        val a = assertNotNull(SleepRules.architecture(deepMin = 80, remMin = 90, awakeMin = 8, totalMin = 450, targets = strict))
        assertEquals(true, a.score < 92)
    }

    @Test
    fun axisLabelsIgnoreTheDeviceZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"))
        // Garmin encodes the wall-clock time as if it were UTC: 2026-11-03 23:00 and 07:00 the next day.
        val start = 1793746800000L
        val end = start + 8 * 3_600_000L
        val labels = Hypnogram.axisLabels(start, end, testFormatters)
        assertEquals(5, labels.size)
        assertEquals(true, "11:00" in labels.first() && labels.first().contains("PM", ignoreCase = true), labels.first())
        assertEquals(true, "7:00" in labels.last() && labels.last().contains("AM", ignoreCase = true), labels.last())
        assertEquals(true, "3:00" in labels[2], labels[2])
    }

    @Test
    fun axisLabelsAreEmptyWithoutTimes() {
        assertEquals(emptyList(), Hypnogram.axisLabels(null, 1L, testFormatters))
        assertEquals(emptyList(), Hypnogram.axisLabels(1L, null, testFormatters))
    }

    @Test
    fun hypnogramLevelMapping() {
        assertEquals(SleepStage.Deep, Hypnogram.stage(3))
        assertEquals(SleepStage.Light, Hypnogram.stage(2))
        assertEquals(SleepStage.Rem, Hypnogram.stage(1))
        assertEquals(SleepStage.Awake, Hypnogram.stage(0))
        assertNull(Hypnogram.stage(4))
        assertNull(Hypnogram.stage(-1))
    }

    @Test
    fun targetMinutesAreTheTotalTimesEachShare() {
        val t = SleepRules.architectureTargetMinutes(450)
        assertEquals(90, t.deep); assertEquals(99, t.rem); assertEquals(23, t.awake)
        assertEquals(0, SleepRules.architectureTargetMinutes(0).deep)
    }
}
