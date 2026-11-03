package io.github.bridgemouse.bacta

import org.junit.Assert.assertEquals
import org.junit.Test

class BactaColorsTest {
    @Test
    fun matchesTheDesignSystemTokens() {
        assertEquals(0xFF0F1117L, BactaColors.Base)
        assertEquals(0xFF111827L, BactaColors.Surface)
        assertEquals(0xFF1E2D3DL, BactaColors.SurfaceElevated)
        assertEquals(0xFF27384AL, BactaColors.Line)
        assertEquals(0xFFF4F7FBL, BactaColors.Text)
        assertEquals(0xFF94A3B8L, BactaColors.TextSecondary)
        assertEquals(0xFF56657AL, BactaColors.TextMuted)
        assertEquals(0xFF2BC4E8L, BactaColors.Mx4)
        assertEquals(0xFF4ADE80L, BactaColors.Positive)
        assertEquals(0xFFFBBF24L, BactaColors.Caution)
        assertEquals(0xFFF87171L, BactaColors.Flag)
    }

    @Test
    fun sectionAccentsAreTheLockedValues() {
        assertEquals(0xFF2BC4E8L, BactaColors.Section.Home)
        assertEquals(0xFF64B5F6L, BactaColors.Section.Recovery)
        assertEquals(0xFFFB923CL, BactaColors.Section.Training)
        assertEquals(0xFFA78BFAL, BactaColors.Section.Sleep)
        assertEquals(0xFF3ECF8EL, BactaColors.Section.Nutrition)
        assertEquals(0xFFEF6F6CL, BactaColors.Section.Bloodwork)
        assertEquals(0xFFF5CF5EL, BactaColors.Section.DailyLog)
    }
}
