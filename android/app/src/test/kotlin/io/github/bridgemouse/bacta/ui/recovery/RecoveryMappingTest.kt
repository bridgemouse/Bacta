package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

private fun toRecoveryContent(s: Summary, t: Map<Metric, Result<List<Double>>>) = io.github.bridgemouse.bacta.ui.recovery.toRecoveryContent(s, t, testFormatters)

class RecoveryMappingTest {
    private val failed: Map<Metric, Result<List<Double>>> = Metric.entries.associateWith { Result.failure(IOException("x")) }
    private fun ok(vararg v: Pair<Metric, List<Double>>) = failed + v.associate { (m, s) -> m to Result.success(s) }
    private val week = listOf(54.0, 56.0, 55.0, 58.0, 60.0, 59.0, 62.0)

    private val full = Summary(
        recoveryScore = 83.0, hrv = 62.0, hrvWeekAvg = 58.0, hrvBaselineLow = 48.0, hrvBaselineHigh = 72.0,
        bodyBatteryCurrent = 74.0, bodyBatteryWake = 92.0, recoveryTimeHours = 0.3, restingHr = 52.0, stressAvg = 27.0,
        sleepStress = 18.0, respAvg = 14.5, spo2Avg = 96.0, sleepHr = 44.1,
    )

    @Test
    fun nullMetricsRenderDashesAndNoToneColor() {
        val c = toRecoveryContent(Summary(), failed)
        assertNull(c.readiness.value); assertNull(c.readiness.valueText); assertNull(c.readiness.tone); assertNull(c.readiness.stateText)
        assertNull(c.hrv.value); assertTrue(c.hrv.chips.isEmpty()); assertNull(c.hrv.delta)
        assertNull(c.battery); assertNull(c.recoveryTime)
        assertEquals(listOf(null, null), c.pair.map { it.value.s() })
        assertEquals(listOf("Respiration"), c.vitals.map { it.label.s() })
        assertTrue(c.vitals.all { it.value == null && it.tone == null })
        assertTrue(c.trends.isEmpty())
    }

    @Test
    fun readinessUsesTheDomainScoreLabel() {
        val g = toRecoveryContent(full, failed).readiness
        assertEquals("83", g.valueText)
        assertEquals("OPTIMAL", g.stateText.s())
        assertEquals("/ 100", g.caption.s())
        assertEquals("READY", toRecoveryContent(full.copy(recoveryScore = 70.0), failed).readiness.stateText.s())
        assertEquals("LOW", toRecoveryContent(full.copy(recoveryScore = 40.0), failed).readiness.stateText.s())
    }

    @Test
    fun batteryAndRecoveryTimeUseTheDomainBands() {
        val c = toRecoveryContent(full, failed)
        val battery = assertNotNull(c.battery)
        assertEquals("74", battery.valueText)
        assertEquals("MODERATE", battery.stateText.s())
        assertEquals(Tone.Caution, battery.tone)
        assertEquals("WAKE 92%", battery.caption.s())
        assertEquals("-18 used", battery.rightLabel.s())
        val meter = assertNotNull(c.recoveryTime)
        assertEquals("0.3", meter.value.s())
        assertEquals("FRESH", meter.stateText.s())
        assertNull(meter.tone)
        assertEquals(0.3 / 72.0, meter.position!!.toDouble(), 1e-6)
    }

    @Test
    fun hrvHeadlineCarriesBaselineDeltaAndDirection() {
        val h = toRecoveryContent(full, ok(Metric.Hrv to week)).hrv
        assertEquals("62", h.value)
        assertEquals("▲ 4 ms", h.delta?.text.s())
        assertEquals("vs 58 ms week avg", h.sub.s())
        assertEquals(48.0..72.0, h.band)
        assertEquals(listOf("IN RANGE", "↑ IMPROVING"), h.chips.map { it.text.s() })
        assertEquals("baseline 48–72 ms · 7d avg 58 ms", h.footnote.s())
    }

    @Test
    fun hrvOutOfRangeAndDirectionAppearOnlyWithEnoughData() {
        val low = toRecoveryContent(full.copy(hrv = 40.0), ok(Metric.Hrv to listOf(60.0, 50.0))).hrv
        assertEquals(listOf("OUT OF RANGE"), low.chips.map { it.text.s() })
    }

    @Test
    fun stressSubCombinesDeltaAndLabel() {
        val c = toRecoveryContent(full, ok(Metric.StressAvg to listOf(24.0, 26.0, 25.0, 28.0, 27.0, 27.0)))
        assertEquals("27", c.pair[1].value.s())
        assertTrue(c.pair[1].sub.s()!!.endsWith("· MODERATE"))
    }

    @Test
    fun vitalsAreOnlyThoseWithData() {
        val c = toRecoveryContent(full, failed)
        assertEquals(listOf("Sleep stress", "Respiration", "SpO₂", "Sleep HR"), c.vitals.map { it.label.s() })
        assertEquals(Tone.Positive, c.vitals[0].tone)
        assertNull(c.vitals[3].tone)
        val none = toRecoveryContent(full.copy(spo2Avg = null, sleepHr = null, sleepStress = null), failed)
        assertEquals(listOf("Respiration"), none.vitals.map { it.label.s() })
    }

    @Test
    fun trendsTabHasEightSectionsInWebOrder() {
        val all = Metric.entries.associateWith { Result.success(week) }
        val sections = toRecoveryContent(full, all).trends
        assertEquals(
            listOf("RECOVERY SCORE", "HRV", "BODY BATTERY", "RESTING HR", "OVERNIGHT STRESS", "SLEEP STRESS", "RECOVERY TIME", "RESPIRATION"),
            sections.map { it.rail.s() },
        )
        assertEquals(TrendKind.Bars, sections[0].card.kind)
        assertEquals(TrendKind.Bars, sections[2].card.kind)
        assertEquals(58.0, sections[1].card.average)
    }

    @Test
    fun aSectionWithoutASeriesIsOmitted() {
        val sections = toRecoveryContent(full, ok(Metric.Hrv to week)).trends
        assertEquals(listOf("HRV"), sections.map { it.rail.s() })
    }

    @Test
    fun lowerIsBetterMetricsColorTheirDeltaAccordingly() {
        val sections = toRecoveryContent(full, ok(Metric.RestingHr to listOf(50.0, 50.0, 50.0, 50.0))).trends
        val delta = sections.single().card.delta
        assertEquals("▲ 2.0", delta?.text.s())
        assertEquals(io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection.Bad, delta?.direction)
    }
}
