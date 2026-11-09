package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section

/**
 * One simple outline icon per section, drawn from plain SVG path data on a 24 dp grid (stroked, so [androidx.compose.material3.Icon]'s
 * tint colours it): a house, a pulse line, a crescent and rising chevrons. The shapes are generic geometry, not taken from any icon set.
 */
object SectionIcons {
    private val cache = mutableMapOf<Section, ImageVector>()

    fun of(section: Section): ImageVector = cache.getOrPut(section) {
        when (section) {
            Section.Home -> icon("Home", "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10")
            Section.Recovery -> icon("Recovery", "M22 12h-4l-3 9L9 3l-3 9H2")
            Section.Sleep -> icon("Sleep", "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z")
            Section.Training -> icon("Training", "M17 11l-5-5-5 5", "M17 18l-5-5-5 5")
        }
    }

    private fun icon(name: String, vararg paths: String): ImageVector = ImageVector.Builder(
        name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f,
    ).apply {
        paths.forEach { data ->
            addPath(
                pathData = PathParser().parsePathString(data).toNodes(),
                stroke = SolidColor(Color.White),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
    }.build()
}
