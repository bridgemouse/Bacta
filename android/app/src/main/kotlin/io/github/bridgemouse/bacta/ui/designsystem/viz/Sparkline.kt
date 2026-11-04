package io.github.bridgemouse.bacta.ui.designsystem.viz

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import kotlin.math.max
import kotlin.math.min

/** A filled line chart. Paths and the gradient are built once per size (drawWithCache). */
@Composable
fun Sparkline(
    series: List<Double>,
    accent: Color,
    description: String,
    modifier: Modifier = Modifier,
    fill: Boolean = true,
    average: Double? = null,
    band: ClosedFloatingPointRange<Double>? = null,
) {
    Spacer(
        modifier
            .semantics { contentDescription = description }
            .drawWithCache {
                val n = series.size
                if (n < 2) return@drawWithCache onDrawBehind { }
                var lo = series.min()
                var hi = series.max()
                average?.let { lo = min(lo, it); hi = max(hi, it) }
                band?.let { lo = min(lo, it.start); hi = max(hi, it.endInclusive) }
                val span = if (hi - lo > 0.0) hi - lo else 1.0
                val padY = 4.dp.toPx()
                val h = size.height - 2 * padY
                val w = size.width
                fun x(i: Int) = w * i / (n - 1)
                fun y(v: Double) = padY + h * (1f - ((v - lo) / span).toFloat())
                val line = Path().apply {
                    moveTo(x(0), y(series[0]))
                    for (i in 1 until n) lineTo(x(i), y(series[i]))
                }
                val area = Path().apply {
                    addPath(line)
                    lineTo(w, size.height)
                    lineTo(0f, size.height)
                    close()
                }
                val brush = Brush.verticalGradient(listOf(accent.copy(alpha = 0.28f), Color.Transparent))
                val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
                onDrawBehind {
                    band?.let {
                        val top = y(it.endInclusive)
                        drawRect(accent.copy(alpha = 0.08f), Offset(0f, top), androidx.compose.ui.geometry.Size(w, y(it.start) - top))
                    }
                    if (fill) drawPath(area, brush)
                    average?.let {
                        drawLine(accent.copy(alpha = 0.4f), Offset(0f, y(it)), Offset(w, y(it)), strokeWidth = 1f, pathEffect = dash)
                    }
                    drawPath(line, accent, style = Stroke(width = 1.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawCircle(accent, radius = 3.dp.toPx(), center = Offset(x(n - 1), y(series.last())))
                }
            },
    )
}

/** Day bars with labels; the last bar is highlighted. */
/** Share of the available height a bar takes; a floor keeps tiny values visible. */
internal fun barFraction(value: Double, max: Double): Float = (value / max).toFloat().coerceIn(0.08f, 1f)

@Composable
fun BarsChart(
    series: List<Double>,
    accent: Color,
    labels: List<String>,
    description: String,
    modifier: Modifier = Modifier,
) {
    val hi = (series.maxOrNull() ?: 0.0).takeIf { it > 0.0 } ?: 1.0
    Row(
        modifier.semantics { contentDescription = description },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        series.forEachIndexed { i, v ->
            val last = i == series.lastIndex
            Column(
                Modifier.weight(1f).fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    Spacer(
                        Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(barFraction(v, hi))
                            .background(
                                if (last) accent else accent.copy(alpha = 0.22f),
                                RoundedCornerShape(3.dp),
                            ),
                    )
                }
                if (labels.getOrNull(i) != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        labels[i],
                        style = MaterialTheme.typography.labelSmall,
                        color = if (last) accent else MaterialTheme.colorScheme.textSecondary,
                    )
                }
            }
        }
    }
}
