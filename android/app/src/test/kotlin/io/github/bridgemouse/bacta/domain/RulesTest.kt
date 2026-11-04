package io.github.bridgemouse.bacta.domain

import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.Test

class RulesTest {
    @Test
    fun scoreLabelBoundaries() {
        assertEquals("Low", ReadinessRules.scoreLabel(66.0))
        assertEquals("Ready", ReadinessRules.scoreLabel(67.0))
        assertEquals("Ready", ReadinessRules.scoreLabel(79.0))
        assertEquals("Optimal", ReadinessRules.scoreLabel(80.0))
        assertNull(ReadinessRules.scoreLabel(null))
    }

    @Test
    fun batteryBandBoundaries() {
        assertEquals(Band("HIGH", Tone.Positive), ReadinessRules.batteryBand(75.0))
        assertEquals(Band("MODERATE", Tone.Caution), ReadinessRules.batteryBand(74.0))
        assertEquals(Band("MODERATE", Tone.Caution), ReadinessRules.batteryBand(50.0))
        assertEquals(Band("LOW", Tone.Caution), ReadinessRules.batteryBand(49.0))
        assertEquals(Band("LOW", Tone.Caution), ReadinessRules.batteryBand(25.0))
        assertEquals(Band("CRITICAL", Tone.Flag), ReadinessRules.batteryBand(24.0))
        assertEquals(Band("CRITICAL", Tone.Flag), ReadinessRules.batteryBand(0.0))
        assertNull(ReadinessRules.batteryBand(null))
    }

    @Test
    fun recoveryTimeBandBoundaries() {
        assertEquals("READY NOW", ReadinessRules.recoveryTimeBand(0.0)?.label)
        assertEquals(Tone.Positive, ReadinessRules.recoveryTimeBand(0.0)?.tone)
        assertEquals("FRESH", ReadinessRules.recoveryTimeBand(0.5)?.label)
        assertEquals("FRESH", ReadinessRules.recoveryTimeBand(24.0)?.label)
        assertNull(ReadinessRules.recoveryTimeBand(24.0)?.tone)
        assertEquals("RECOVERING", ReadinessRules.recoveryTimeBand(25.0)?.label)
        assertEquals("RECOVERING", ReadinessRules.recoveryTimeBand(48.0)?.label)
        assertEquals(Tone.Caution, ReadinessRules.recoveryTimeBand(48.0)?.tone)
        assertEquals("HEAVY LOAD", ReadinessRules.recoveryTimeBand(49.0)?.label)
        assertEquals(Tone.Flag, ReadinessRules.recoveryTimeBand(49.0)?.tone)
        assertNull(ReadinessRules.recoveryTimeBand(null))
    }

    @Test
    fun recoveryTimePositionIsClampedToThreeDays() {
        assertEquals(0.5f, ReadinessRules.recoveryTimePosition(36.0))
        assertEquals(1f, ReadinessRules.recoveryTimePosition(200.0))
        assertEquals(0f, ReadinessRules.recoveryTimePosition(-3.0))
    }

    @Test
    fun hrvTrendDirection() {
        assertEquals(HrvDirection.Rising, HrvTrend.direction(listOf(50.0, 52.0, 54.0, 56.0, 58.0, 60.0, 62.0)))
        assertEquals(HrvDirection.Falling, HrvTrend.direction(listOf(62.0, 60.0, 58.0, 56.0, 54.0, 52.0, 50.0)))
        assertEquals(HrvDirection.Flat, HrvTrend.direction(listOf(60.0, 60.2, 59.9, 60.1, 60.0, 59.9, 60.1)))
        assertNull(HrvTrend.direction(listOf(60.0, 70.0)))
        assertNull(HrvTrend.direction(emptyList()))
    }

    @Test
    fun hrvTrendSlopeIsPerDay() {
        assertEquals(2.0, HrvTrend.slope(listOf(50.0, 52.0, 54.0, 56.0)))
    }

    @Test
    fun freshnessSwitchesToStaleAfterThirtySixHours() {
        val generated = Instant.parse("2026-11-01T00:00:00Z")
        assertEquals(Freshness.Fresh, Freshness.of(generated, generated.plusSeconds(35 * 3600)))
        assertEquals(Freshness.Stale, Freshness.of(generated, generated.plusSeconds(37 * 3600)))
    }

    @Test
    fun trainingStatusLabelsOnlyForVerifiedCodes() {
        assertEquals("Overreaching", TrainingStatus.label(3.0))
        assertEquals("Maintaining", TrainingStatus.label(4.0))
        assertEquals("Recovery", TrainingStatus.label(5.0))
        assertEquals("Productive", TrainingStatus.label(7.0))
        assertEquals("Strained", TrainingStatus.label(8.0))
        assertNull(TrainingStatus.label(0.0))
        assertNull(TrainingStatus.label(10.0))
        assertNull(TrainingStatus.label(null))
    }

    @Test
    fun stressLabelBoundaries() {
        assertEquals("LOW", ReadinessRules.stressLabel(25.0))
        assertEquals("MODERATE", ReadinessRules.stressLabel(26.0))
        assertEquals("MODERATE", ReadinessRules.stressLabel(50.0))
        assertEquals("HIGH", ReadinessRules.stressLabel(51.0))
        assertEquals("HIGH", ReadinessRules.stressLabel(75.0))
        assertEquals("VERY HIGH", ReadinessRules.stressLabel(76.0))
        assertNull(ReadinessRules.stressLabel(null))
    }

    @Test
    fun overnightVitalBands() {
        assertEquals(Band("LOW · rest zone", Tone.Positive), ReadinessRules.sleepStressBand(25.0))
        assertEquals(Band("LOW–MODERATE", Tone.Caution), ReadinessRules.sleepStressBand(26.0))
        assertEquals(Band("ELEVATED", Tone.Caution), ReadinessRules.sleepStressBand(51.0))
        assertEquals(Band("12–20 normal", Tone.Positive), ReadinessRules.respirationBand(12.0))
        assertEquals(Band("12–20 normal", Tone.Positive), ReadinessRules.respirationBand(20.0))
        assertEquals(Band("outside 12–20", Tone.Caution), ReadinessRules.respirationBand(20.5))
        assertEquals(Band("excellent", Tone.Positive), ReadinessRules.spo2Band(97.0))
        assertEquals(Band("normal", Tone.Positive), ReadinessRules.spo2Band(95.0))
        assertEquals(Band("below normal", Tone.Caution), ReadinessRules.spo2Band(94.0))
        assertNull(ReadinessRules.spo2Band(null))
    }
}
