package io.github.bridgemouse.bacta.ui.designsystem.viz

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette

enum class SigilMood { Idle, Transmit, Think, Pleased }

/** MX-4's mark: a core with orbiting arcs. Decorative, so hidden from screen readers. */
@Composable
fun MX4Sigil(
    mood: SigilMood,
    size: Dp,
    modifier: Modifier = Modifier,
    color: Color = BactaPalette.Mx4,
) {
    val periodMs = when (mood) {
        SigilMood.Idle -> 14000
        SigilMood.Pleased -> 9000
        SigilMood.Transmit -> 6000
        SigilMood.Think -> 2500
    }
    val transition = rememberInfiniteTransition(label = "sigil")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(periodMs, easing = LinearEasing), RepeatMode.Restart),
        label = "sigil-angle",
    )
    Canvas(modifier.size(size).clearAndSetSemantics { }) {
        val r = this.size.minDimension / 2f
        val stroke = 1.5.dp.toPx()
        val inset = stroke
        val arc = Size(this.size.width - 2 * inset, this.size.height - 2 * inset)
        drawCircle(color.copy(alpha = 0.25f), radius = r - inset, style = Stroke(1.dp.toPx()))
        rotate(angle) {
            drawArc(color, 0f, 80f, false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
            drawArc(color.copy(alpha = 0.6f), 180f, 50f, false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        drawCircle(color, radius = r * 0.2f)
    }
}
