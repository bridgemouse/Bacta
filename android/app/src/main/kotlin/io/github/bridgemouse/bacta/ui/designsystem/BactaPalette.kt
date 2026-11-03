package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone

object BactaPalette {
    val Base = Color(0xFF0F1117)
    val Surface = Color(0xFF111827)
    val SurfaceElevated = Color(0xFF1E2D3D)
    val Line = Color(0xFF27384A)
    val Text = Color(0xFFF4F7FB)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted = Color(0xFF56657A)
    val Mx4 = Color(0xFF2BC4E8)
    val Positive = Color(0xFF4ADE80)
    val Caution = Color(0xFFFBBF24)
    val Flag = Color(0xFFF87171)

    fun accent(section: Section): Color = when (section) {
        Section.Home -> Mx4
        Section.Recovery -> Color(0xFF64B5F6)
        Section.Training -> Color(0xFFFB923C)
        Section.Sleep -> Color(0xFFA78BFA)
    }

    fun tone(tone: Tone): Color = when (tone) {
        Tone.Positive -> Positive
        Tone.Caution -> Caution
        Tone.Flag -> Flag
    }
}

enum class CardSize(val height: Dp) {
    Hero(220.dp),
    Chart(170.dp),
    Bar(140.dp),
    Pair(110.dp),
    Tile(88.dp),
    Row(52.dp),
}
