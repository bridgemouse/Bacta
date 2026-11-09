package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import kotlin.math.max

/**
 * Android's "expanded" window width starts at 840 dp (window size classes: compact < 600, medium < 840, expanded >= 840). From there
 * the cards flow into two columns, which is what an unfolded inner screen has room for.
 */
const val EXPANDED_WIDTH_DP = 840f

fun columnCountFor(widthDp: Float): Int = if (widthDp >= EXPANDED_WIDTH_DP) 2 else 1

data class ColumnItem(val height: Int, val fullWidth: Boolean)

/** [column] is -1 for a full-width item. */
data class Placement(val column: Int, val y: Int)

/**
 * Masonry placement: each ordinary item goes under the shorter column, and a full-width item (a section rail, the briefing) waits until
 * both columns are clear and starts a new row, so groups of cards stay under their own heading. With one column everything just stacks.
 */
fun placeColumns(items: List<ColumnItem>, columns: Int, gap: Int): List<Placement> {
    val tops = IntArray(columns.coerceAtLeast(1))
    return items.map { item ->
        if (item.fullWidth || tops.size == 1) {
            val y = tops.max()
            tops.fill(y + item.height + gap)
            Placement(if (item.fullWidth) -1 else 0, y)
        } else {
            val column = tops.indices.minBy { tops[it] }
            val y = tops[column]
            tops[column] = y + item.height + gap
            Placement(column, y)
        }
    }
}

/** Total height of the placed items, without the trailing gap. */
fun layoutHeight(items: List<ColumnItem>, placements: List<Placement>, gap: Int): Int =
    items.indices.maxOfOrNull { placements[it].y + items[it].height } ?: 0

private const val FULL_WIDTH = "fullWidth"

/** Marks a child of [AdaptiveColumns] that should span both columns. */
fun Modifier.fullWidth(): Modifier = layoutId(FULL_WIDTH)

/** A vertical stack that becomes two masonry columns on an expanded-width window; children marked [fullWidth] span both. */
@Composable
fun AdaptiveColumns(modifier: Modifier = Modifier, gap: androidx.compose.ui.unit.Dp = 9.dp, content: @Composable () -> Unit) {
    Layout(content, modifier) { measurables, constraints ->
        val gapPx = gap.roundToPx()
        val width = constraints.maxWidth
        val columns = columnCountFor(width / density)
        val columnWidth = if (columns == 1) width else (width - gapPx) / 2
        val placeables: List<Pair<Placeable, Boolean>> = measurables.map { m ->
            val full = m.layoutId == FULL_WIDTH
            val w = if (full || columns == 1) width else columnWidth
            m.measure(Constraints(minWidth = w, maxWidth = w)) to full
        }
        val items = placeables.map { (p, full) -> ColumnItem(p.height, full) }
        val placements = placeColumns(items, columns, gapPx)
        layout(width, layoutHeight(items, placements, gapPx)) {
            placeables.forEachIndexed { i, (p, _) ->
                val x = if (placements[i].column == 1) columnWidth + gapPx else 0
                p.placeRelative(x, placements[i].y)
            }
        }
    }
}
