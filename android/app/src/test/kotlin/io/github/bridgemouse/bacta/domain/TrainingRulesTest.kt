package io.github.bridgemouse.bacta.domain

import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.junit.Test

class TrainingRulesTest {
    @Test
    fun loadStateBoundaries() {
        assertEquals("Low", TrainingRules.loadState(199.9, 200.0, 375.0)?.label)
        assertEquals("Optimal", TrainingRules.loadState(200.0, 200.0, 375.0)?.label)
        assertEquals("Optimal", TrainingRules.loadState(375.0, 200.0, 375.0)?.label)
        assertEquals("High", TrainingRules.loadState(375.1, 200.0, 375.0)?.label)
        assertNull(TrainingRules.loadState(null, 200.0, 375.0))
        assertNull(TrainingRules.loadState(300.0, null, 375.0))
        assertNull(TrainingRules.loadState(300.0, 200.0, null))
    }

    @Test
    fun loadRatioIsDerivedFromGarminsOptimalRange() {
        // Garmin's chronic load is min / 0.8 (= max / 1.5) and its ratio is acute / chronic (synthetic numbers).
        val r = assertNotNull(TrainingRules.loadRatio(acute = 300.0, min = 200.0, max = 375.0))
        assertEquals(250.0, r.chronic, 0.01)
        assertEquals(1.2, r.value, 0.001)
        assertEquals("Optimal", r.state.label)
    }

    @Test
    fun loadRatioBandsBothSides() {
        assertEquals("Low", TrainingRules.loadRatio(199.9, 200.0, 375.0)?.state?.label)
        assertEquals("Optimal", TrainingRules.loadRatio(200.0, 200.0, 375.0)?.state?.label)
        assertEquals("Optimal", TrainingRules.loadRatio(375.0, 200.0, 375.0)?.state?.label)
        assertEquals("High", TrainingRules.loadRatio(375.1, 200.0, 375.0)?.state?.label)
    }

    @Test
    fun loadRatioNeedsAUsableRange() {
        assertNull(TrainingRules.loadRatio(null, 200.0, 375.0))
        assertNull(TrainingRules.loadRatio(300.0, null, 375.0))
        assertNull(TrainingRules.loadRatio(300.0, 0.0, 375.0))
        assertNull(TrainingRules.loadRatio(300.0, -5.0, 375.0))
    }

    @Test
    fun zonePercentsSumToOneHundredOrNull() {
        assertEquals(100, TrainingRules.zonePercents(listOf(12.0, 25.0, 18.0, 6.0, 1.0))?.sum())
        assertEquals(100, TrainingRules.zonePercents(listOf(1.0, 1.0, 1.0, null, null))?.sum())
        assertEquals(listOf(100, 0, 0, 0, 0), TrainingRules.zonePercents(listOf(5.0, null, null, null, null)))
        assertNull(TrainingRules.zonePercents(listOf(0.0, null, 0.0, null, null)))
        assertNull(TrainingRules.zonePercents(List(5) { null }))
    }

    @Test
    fun intensityCountsVigorousDouble() {
        assertEquals(135.0, TrainingRules.intensityPoints(95.0, 20.0))
        assertEquals(0.0, TrainingRules.intensityPoints(0.0, 0.0))
    }

    @Test
    fun theRatioMarkerClampsToTheTrack() {
        assertEquals(0f, TrainingRules.ratioTrackPosition(0.2), 0.0001f)
        assertEquals(0.4667f, TrainingRules.ratioTrackPosition(1.2), 0.001f)
        assertEquals(1f, TrainingRules.ratioTrackPosition(5.0), 0.0001f)
    }

    @Test
    fun theOptimalZoneSitsAtGarminsBoundsOnTheTrack() {
        assertEquals(0.2f, TrainingRules.ratioTrackPosition(TrainingRules.OPTIMAL_LOW), 0.001f)
        assertEquals(0.6667f, TrainingRules.ratioTrackPosition(TrainingRules.OPTIMAL_HIGH), 0.001f)
    }
}
