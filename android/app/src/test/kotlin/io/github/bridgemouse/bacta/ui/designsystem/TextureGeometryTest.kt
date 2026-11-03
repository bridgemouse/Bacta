package io.github.bridgemouse.bacta.ui.designsystem

import org.junit.Assert.assertEquals
import org.junit.Test

class TextureGeometryTest {
    @Test
    fun linePositionsStartAtZeroAndStayInsideTheExtent() {
        assertEquals(listOf(0f, 26f, 52f), linePositions(extent = 60f, step = 26f))
    }

    @Test
    fun anEmptyExtentHasNoLines() {
        assertEquals(emptyList<Float>(), linePositions(extent = 0f, step = 26f))
    }
}
