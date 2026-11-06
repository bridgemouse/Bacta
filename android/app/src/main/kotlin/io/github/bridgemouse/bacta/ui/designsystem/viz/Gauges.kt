package io.github.bridgemouse.bacta.ui.designsystem.viz

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
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
import androidx.compose.ui.unit.min
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import kotlin.math.sin

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

/**
 * How much of the full circle's height an arc of [sweep] degrees occupies (the gap is at the bottom). A semicircle or less is half the
 * circle; wider arcs dip below the centre by sin((sweep - 180) / 2). Used to size the box to the arc, so no empty band sits under it.
 */
fun arcExtentFraction(sweep: Float): Float {
    if (sweep >= 360f) return 1f
    val below = if (sweep > 180f) sin(Math.toRadians(((sweep - 180f) / 2f).toDouble())).toFloat() else 0f
    return (1f + below) / 2f
}

/** Width divided by height for a box that fits exactly the arc of [sweep] degrees. */
fun arcAspectRatio(sweep: Float): Float = 1f / arcExtentFraction(sweep)

/**
 * An open arc gauge (default 240 degrees, gap at the bottom). A null progress draws only the track. Give it a width and
 * `Modifier.aspectRatio(arcAspectRatio(sweep))`: the circle fills the width and its centre is where [content] is centred.
 */
@Composable
fun ArcGauge(
    progress: Float?,
    color: Color,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 10.dp,
    sweep: Float = 240f,
    content: @Composable BoxScope.() -> Unit = {},
) {
    BoxWithConstraints(modifier) {
        val extent = arcExtentFraction(sweep)
        val diameter = min(maxWidth - strokeWidth, (maxHeight - strokeWidth) / extent)
        Canvas(Modifier.matchParentSize()) {
            val stroke = strokeWidth.toPx()
            val side = diameter.toPx()
            val topLeft = Offset((size.width - side) / 2, stroke / 2)
            val arcSize = Size(side, side)
            val start = 90f + (360f - sweep) / 2f
            drawArc(BactaPalette.Line, start, sweep, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            if (progress != null) {
                drawArc(color, start, sweep * progress.coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
        }
        // The content box is the circle's own square, so its centre is the circle's centre even though the arc box is shorter.
        Box(Modifier.align(Alignment.TopCenter).padding(top = strokeWidth / 2).requiredSize(diameter), contentAlignment = Alignment.Center, content = content)
    }
}

/** One ring of [ConcentricArcs]: how full it is and its colour. */
data class ArcRing(val progress: Float, val color: Color)

/**
 * Several open arcs sharing one centre, the first ring outermost, each stepped inward by a stroke plus [gap]. Sized like [ArcGauge]:
 * give it a width and `Modifier.aspectRatio(arcAspectRatio(sweep))`. [content] is centred on the common centre.
 */
@Composable
fun ConcentricArcs(
    rings: List<ArcRing>,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 12.dp,
    gap: Dp = 6.dp,
    sweep: Float = 200f,
    content: @Composable BoxScope.() -> Unit = {},
) {
    BoxWithConstraints(modifier) {
        val extent = arcExtentFraction(sweep)
        val outer = min(maxWidth - strokeWidth, (maxHeight - strokeWidth) / extent)
        Canvas(Modifier.matchParentSize()) {
            val stroke = strokeWidth.toPx()
            val step = stroke + gap.toPx()
            val start = 90f + (360f - sweep) / 2f
            rings.forEachIndexed { i, ring ->
                val side = outer.toPx() - 2 * i * step
                if (side <= 0f) return@forEachIndexed
                val topLeft = Offset((size.width - side) / 2, stroke / 2 + i * step)
                val arcSize = Size(side, side)
                drawArc(BactaPalette.Line, start, sweep, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                drawArc(ring.color, start, sweep * ring.progress.coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
        }
        Box(Modifier.align(Alignment.TopCenter).padding(top = strokeWidth / 2).requiredSize(outer), contentAlignment = Alignment.Center, content = content)
    }
}
