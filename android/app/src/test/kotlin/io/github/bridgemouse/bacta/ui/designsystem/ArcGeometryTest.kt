package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.ui.designsystem.viz.arcAspectRatio
import io.github.bridgemouse.bacta.ui.designsystem.viz.arcExtentFraction
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

class ArcGeometryTest {
    @Test
    fun aSemicircleOrLessOnlyNeedsHalfTheCircleHeight() {
        assertEquals(0.5f, arcExtentFraction(180f), 0.001f)
        assertEquals(0.5f, arcExtentFraction(120f), 0.001f)
    }

    @Test
    fun theOpenGaugesReachBelowTheCentreByTheirSweep() {
        // 200 degrees dips 10 degrees past horizontal on each side: (1 + sin 10 deg) / 2
        assertEquals(0.5868f, arcExtentFraction(200f), 0.001f)
        // 240 degrees: (1 + sin 30 deg) / 2
        assertEquals(0.75f, arcExtentFraction(240f), 0.001f)
        assertEquals(1f, arcExtentFraction(360f), 0.001f)
    }

    @Test
    fun theBoxIsAsWideAsItIsTallTimesTheInverseOfTheExtent() {
        assertTrue(arcAspectRatio(200f) > arcAspectRatio(240f))
        assertEquals(1f / 0.75f, arcAspectRatio(240f), 0.001f)
    }
}
