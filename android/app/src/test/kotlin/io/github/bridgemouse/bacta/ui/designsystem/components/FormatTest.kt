package io.github.bridgemouse.bacta.ui.designsystem.components

import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FormatTest {
    @Test
    fun formatValueRendersDashForNull() {
        assertEquals("—", formatValue(null))
    }

    @Test
    fun formatValueRoundsToTheRequestedDecimals() {
        assertEquals("74", formatValue(74.0))
        assertEquals("74", formatValue(73.6))
        assertEquals("7.5", formatValue(7.46, decimals = 1))
        assertEquals("7.0", formatValue(7.0, decimals = 1))
    }

    @Test
    fun formatValueUsesADotRegardlessOfTheDeviceLocale() {
        val original = Locale.getDefault()
        try {
            Locale.setDefault(Locale.GERMANY)
            assertEquals("7.5", formatValue(7.46, decimals = 1))
        } finally {
            Locale.setDefault(original)
        }
    }

    @Test
    fun deltaDirectionRespectsLowerIsBetter() {
        assertEquals(DeltaDirection.Good, deltaDirection(2.0, lowerIsBetter = false))
        assertEquals(DeltaDirection.Bad, deltaDirection(-2.0, lowerIsBetter = false))
        assertEquals(DeltaDirection.Bad, deltaDirection(2.0, lowerIsBetter = true))
        assertEquals(DeltaDirection.Good, deltaDirection(-2.0, lowerIsBetter = true))
        assertEquals(DeltaDirection.Flat, deltaDirection(0.0, lowerIsBetter = false))
    }

    @Test
    fun formatDeltaShowsAnArrowAndTheMagnitude() {
        assertEquals("▲ 0.5", formatDelta(0.5, decimals = 1))
        assertEquals("▼ 1.6", formatDelta(-1.6, decimals = 1))
        assertEquals("→ 0", formatDelta(0.0, decimals = 0))
        assertNull(formatDelta(null, decimals = 1))
    }

    @Test
    fun describeSeriesSummarisesATrendForScreenReaders() {
        assertEquals(
            "HRV, 7 days: from 54 to 62, high 62, low 54",
            describeSeries("HRV", listOf(54.0, 58.0, 62.0), period = "7 days"),
        )
        assertEquals(
            "Sleep stress, 7 days: from 17.5 to 18.5, high 18.5, low 17.5",
            describeSeries("Sleep stress", listOf(17.5, 18.5), period = "7 days"),
        )
        assertEquals("HRV: no data", describeSeries("HRV", emptyList(), period = "7 days"))
    }
}
