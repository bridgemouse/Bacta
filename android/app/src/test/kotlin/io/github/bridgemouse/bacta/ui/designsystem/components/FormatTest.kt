package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.UiText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FormatTest {
    @Test
    fun deltaDirectionRespectsLowerIsBetter() {
        assertEquals(DeltaDirection.Good, deltaDirection(2.0, lowerIsBetter = false))
        assertEquals(DeltaDirection.Bad, deltaDirection(-2.0, lowerIsBetter = false))
        assertEquals(DeltaDirection.Bad, deltaDirection(2.0, lowerIsBetter = true))
        assertEquals(DeltaDirection.Good, deltaDirection(-2.0, lowerIsBetter = true))
        assertEquals(DeltaDirection.Flat, deltaDirection(0.0, lowerIsBetter = false))
    }

    @Test
    fun deltaShowsAnArrowAndTheMagnitude() {
        assertEquals("▲ 0.5", testFormatters.delta(0.5, decimals = 1).s())
        assertEquals("▼ 1.6", testFormatters.delta(-1.6, decimals = 1).s())
        assertEquals("→ 0", testFormatters.delta(0.0, decimals = 0).s())
        assertNull(testFormatters.delta(null, decimals = 1))
    }

    @Test
    fun describeSeriesSummarisesATrendForScreenReaders() {
        val hrv = UiText.Literal("HRV")
        val days = UiText.Literal("7 days")
        assertEquals(
            "HRV, 7 days: from 54 to 62, high 62, low 54",
            describeSeries(testFormatters, hrv, listOf(54.0, 58.0, 62.0), days).s(),
        )
        assertEquals(
            "Sleep stress, 7 days: from 17.5 to 18.5, high 18.5, low 17.5",
            describeSeries(testFormatters, UiText.Literal("Sleep stress"), listOf(17.5, 18.5), days).s(),
        )
        assertEquals("HRV: no data", describeSeries(testFormatters, hrv, emptyList(), days).s())
    }
}
