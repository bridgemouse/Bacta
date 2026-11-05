package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.ui.designsystem.viz.HypnogramSegment
import io.github.bridgemouse.bacta.ui.designsystem.viz.hypnogramSegments
import io.github.bridgemouse.bacta.ui.designsystem.viz.stageRow
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

class HypnogramGeometryTest {
    @Test
    fun hypnogramSegmentsMergeRunsAndKeepOrder() {
        val levels = listOf(SleepStage.Light, SleepStage.Light, SleepStage.Deep, SleepStage.Deep, SleepStage.Deep, SleepStage.Rem)
        assertEquals(
            listOf(
                HypnogramSegment(SleepStage.Light, start = 0, length = 2),
                HypnogramSegment(SleepStage.Deep, start = 2, length = 3),
                HypnogramSegment(SleepStage.Rem, start = 5, length = 1),
            ),
            hypnogramSegments(levels),
        )
    }

    @Test
    fun aGapBreaksARunAndIsNeverFilled() {
        val levels = listOf(SleepStage.Light, null, SleepStage.Light)
        assertEquals(
            listOf(HypnogramSegment(SleepStage.Light, 0, 1), HypnogramSegment(SleepStage.Light, 2, 1)),
            hypnogramSegments(levels),
        )
    }

    @Test
    fun noLevelsNoSegments() {
        assertTrue(hypnogramSegments(emptyList()).isEmpty())
        assertTrue(hypnogramSegments(listOf(null, null)).isEmpty())
    }

    @Test
    fun rowsRunFromAwakeAtTheTopToDeepAtTheBottom() {
        assertEquals(listOf(0, 1, 2, 3), listOf(SleepStage.Awake, SleepStage.Rem, SleepStage.Light, SleepStage.Deep).map(::stageRow))
    }
}
