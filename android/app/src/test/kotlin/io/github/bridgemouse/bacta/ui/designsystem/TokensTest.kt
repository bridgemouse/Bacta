package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.ui.graphics.Color
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone
import org.junit.Assert.assertEquals
import org.junit.Test

class TokensTest {
    @Test
    fun paletteMatchesTheDesignSystemTokens() {
        assertEquals(Color(0xFF0F1117), BactaPalette.Base)
        assertEquals(Color(0xFF111827), BactaPalette.Surface)
        assertEquals(Color(0xFF1E2D3D), BactaPalette.SurfaceElevated)
        assertEquals(Color(0xFF27384A), BactaPalette.Line)
        assertEquals(Color(0xFFF4F7FB), BactaPalette.Text)
        assertEquals(Color(0xFF94A3B8), BactaPalette.TextSecondary)
        assertEquals(Color(0xFF56657A), BactaPalette.TextMuted)
        assertEquals(Color(0xFF2BC4E8), BactaPalette.Mx4)
        assertEquals(Color(0xFF4ADE80), BactaPalette.Positive)
        assertEquals(Color(0xFFFBBF24), BactaPalette.Caution)
        assertEquals(Color(0xFFF87171), BactaPalette.Flag)
    }

    @Test
    fun accentsAreTheLockedSectionColors() {
        assertEquals(Color(0xFF2BC4E8), BactaPalette.accent(Section.Home))
        assertEquals(Color(0xFF64B5F6), BactaPalette.accent(Section.Recovery))
        assertEquals(Color(0xFFFB923C), BactaPalette.accent(Section.Training))
        assertEquals(Color(0xFFA78BFA), BactaPalette.accent(Section.Sleep))
    }

    @Test
    fun toneColorsMatchTheStatusTokens() {
        assertEquals(Color(0xFF4ADE80), BactaPalette.tone(Tone.Positive))
        assertEquals(Color(0xFFFBBF24), BactaPalette.tone(Tone.Caution))
        assertEquals(Color(0xFFF87171), BactaPalette.tone(Tone.Flag))
    }

    @Test
    fun cardSizesMatchTheWebHeights() {
        assertEquals(
            listOf(220, 170, 140, 110, 88, 52),
            CardSize.entries.map { it.height.value.toInt() },
        )
        assertEquals(
            listOf("Hero", "Chart", "Bar", "Pair", "Tile", "Row"),
            CardSize.entries.map { it.name },
        )
    }

    @Test
    fun materialSchemeIsBuiltFromThePalette() {
        val scheme = bactaColorScheme
        assertEquals(BactaPalette.Base, scheme.background)
        assertEquals(BactaPalette.Surface, scheme.surface)
        assertEquals(BactaPalette.SurfaceElevated, scheme.surfaceContainerHigh)
        assertEquals(BactaPalette.Text, scheme.onSurface)
        assertEquals(BactaPalette.Line, scheme.outline)
        assertEquals(BactaPalette.Mx4, scheme.primary)
        assertEquals(BactaPalette.Flag, scheme.error)
    }

    @Test
    fun extraTokensAreExposedAsColorSchemeExtensions() {
        val scheme = bactaColorScheme
        assertEquals(BactaPalette.TextSecondary, scheme.textSecondary)
        assertEquals(BactaPalette.TextMuted, scheme.textMuted)
        assertEquals(BactaPalette.Mx4, scheme.mx4)
        assertEquals(BactaPalette.Positive, scheme.positive)
        assertEquals(BactaPalette.Caution, scheme.caution)
        assertEquals(BactaPalette.Flag, scheme.flag)
    }
}
