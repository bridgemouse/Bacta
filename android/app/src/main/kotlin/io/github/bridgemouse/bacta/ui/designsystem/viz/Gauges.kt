package io.github.bridgemouse.bacta.ui.designsystem.viz

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import kotlin.math.min

/** A full circular progress ring with content in the middle. Drawing only; callers set semantics. */
@Composable
fun Ring(
    progress: Float,
    accent: Color,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 4.dp,
    content: @Composable BoxScope.() -> Unit = {},
) {
    Box(
        modifier.drawWithCache {
            val stroke = strokeWidth.toPx()
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(stroke / 2, stroke / 2)
            onDrawBehind {
                drawArc(BactaPalette.Line, 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
                drawArc(accent, -90f, 360f * progress.coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
        },
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** An open arc gauge (default 240 degrees, gap at the bottom). A null progress draws only the track. */
@Composable
fun ArcGauge(
    progress: Float?,
    color: Color,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 10.dp,
    sweep: Float = 240f,
    content: @Composable BoxScope.() -> Unit = {},
) {
    Box(
        modifier.drawWithCache {
            val stroke = strokeWidth.toPx()
            val side = min(size.width, size.height) - stroke
            val topLeft = Offset((size.width - side) / 2, stroke / 2)
            val arcSize = Size(side, side)
            val start = 90f + (360f - sweep) / 2f
            onDrawBehind {
                drawArc(BactaPalette.Line, start, sweep, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                if (progress != null) {
                    drawArc(color, start, sweep * progress.coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                }
            }
        },
        contentAlignment = Alignment.Center,
        content = content,
    )
}
