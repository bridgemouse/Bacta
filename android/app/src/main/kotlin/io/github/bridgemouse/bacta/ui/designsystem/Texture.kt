package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

internal fun linePositions(extent: Float, step: Float): List<Float> {
    if (extent <= 0f || step <= 0f) return emptyList()
    val positions = ArrayList<Float>()
    var p = 0f
    while (p < extent) {
        positions.add(p)
        p += step
    }
    return positions
}

/** The console texture: faint horizontal scanlines plus an accent grid. Paths are cached per size. */
fun Modifier.bactaTexture(accent: Color): Modifier = drawWithCache {
    val scanlines = Path().apply {
        for (y in linePositions(size.height, 3.dp.toPx())) {
            moveTo(0f, y)
            lineTo(size.width, y)
        }
    }
    val grid = Path().apply {
        val step = 26.dp.toPx()
        for (x in linePositions(size.width, step)) {
            moveTo(x, 0f)
            lineTo(x, size.height)
        }
        for (y in linePositions(size.height, step)) {
            moveTo(0f, y)
            lineTo(size.width, y)
        }
    }
    val hairline = Stroke(width = 1f)
    onDrawBehind {
        drawPath(scanlines, Color.White.copy(alpha = 0.016f), style = hairline)
        drawPath(grid, accent.copy(alpha = 0.035f), style = hairline)
    }
}
