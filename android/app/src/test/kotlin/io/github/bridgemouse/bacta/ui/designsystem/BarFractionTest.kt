package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.ui.designsystem.viz.barFraction
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import org.junit.Test

class BarFractionTest {
    @Test
    fun barsScaleWithTheirValue() {
        assertEquals(1f, barFraction(410.0, 410.0))
        assertEquals(0.5f, barFraction(205.0, 410.0))
        assertNotEquals(barFraction(260.0, 410.0), barFraction(410.0, 410.0))
    }

    @Test
    fun aFloorKeepsZeroVisible() = assertEquals(0.08f, barFraction(0.0, 410.0))
}
