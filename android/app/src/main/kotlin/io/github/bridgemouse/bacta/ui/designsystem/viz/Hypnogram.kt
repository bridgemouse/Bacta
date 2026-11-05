package io.github.bridgemouse.bacta.ui.designsystem.viz

import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette

/** A run of the same stage over consecutive blocks. */
data class HypnogramSegment(val stage: SleepStage, val start: Int, val length: Int)

/** Merges equal neighbours into segments; a gap (null) ends a run and is left empty, never filled with a guess. */
fun hypnogramSegments(levels: List<SleepStage?>): List<HypnogramSegment> {
    val out = mutableListOf<HypnogramSegment>()
    var i = 0
    while (i < levels.size) {
        val stage = levels[i]
        if (stage == null) { i++; continue }
        var j = i
        while (j + 1 < levels.size && levels[j + 1] == stage) j++
        out += HypnogramSegment(stage, i, j - i + 1)
        i = j + 1
    }
    return out
}

/** Awake sits at the top and deep at the bottom, the way a hypnogram is conventionally read. */
fun stageRow(stage: SleepStage): Int = when (stage) {
    SleepStage.Awake -> 0
    SleepStage.Rem -> 1
    SleepStage.Light -> 2
    SleepStage.Deep -> 3
}

/** The night as stepped bars, one row per stage. Geometry is built once per size (drawWithCache). */
@Composable
fun Hypnogram(levels: List<SleepStage?>, description: String, modifier: Modifier = Modifier) {
    Spacer(
        modifier
            .semantics { contentDescription = description }
            .drawWithCache {
                val segments = hypnogramSegments(levels)
                val rows = 4
                val gap = 3.dp.toPx()
                val rowH = (size.height - gap * (rows - 1)) / rows
                val blockW = if (levels.isEmpty()) 0f else size.width / levels.size
                val colors: Map<SleepStage, Color> = SleepStage.entries.associateWith(BactaPalette::stage)
                val radius = CornerRadius(rowH / 3f)
                onDrawBehind {
                    for (r in 0 until rows) {
                        drawRoundRect(BactaPalette.Line.copy(alpha = 0.35f), Offset(0f, r * (rowH + gap)), Size(size.width, rowH), radius)
                    }
                    segments.forEach { seg ->
                        drawRoundRect(
                            colors.getValue(seg.stage),
                            Offset(seg.start * blockW, stageRow(seg.stage) * (rowH + gap)),
                            Size(seg.length * blockW, rowH),
                            radius,
                        )
                    }
                }
            },
    )
}
