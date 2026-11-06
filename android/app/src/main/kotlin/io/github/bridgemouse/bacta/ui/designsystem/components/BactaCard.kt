package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

/** The accent top edge and corner brackets every Bacta card wears. The brackets follow the card's own corner radius (inset inward), so they curve with the card instead of meeting at a hard right angle. Cached per size. */
private fun Modifier.cardFrame(accent: Color, shape: CornerBasedShape): Modifier = drawWithCache {
    val len = 10.dp.toPx()
    val inset = 6.dp.toPx()
    val stroke = 1.dp.toPx()
    val radius = (shape.topStart.toPx(size, this) - inset).coerceAtLeast(2.dp.toPx())
    val bracket = accent.copy(alpha = 0.55f)
    val edge = Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0f)))
    // Control-point offset that makes a cubic Bezier trace a circular quarter arc.
    val k = 0.5523f
    fun corner(x: Float, y: Float, dx: Float, dy: Float) = Path().apply {
        moveTo(x + dx * len, y)
        lineTo(x + dx * radius, y)
        cubicTo(x + dx * radius * (1 - k), y, x, y + dy * radius * (1 - k), x, y + dy * radius)
        lineTo(x, y + dy * len)
    }
    onDrawBehind {
        drawRect(edge, size = Size(size.width, 2.dp.toPx()))
        val style = Stroke(stroke)
        drawPath(corner(inset, inset, 1f, 1f), bracket, style = style)
        drawPath(corner(size.width - inset, inset, -1f, 1f), bracket, style = style)
        drawPath(corner(inset, size.height - inset, 1f, -1f), bracket, style = style)
        drawPath(corner(size.width - inset, size.height - inset, -1f, -1f), bracket, style = style)
    }
}

/** The base of every card template. Stateless; pass [onClick] to make the whole card a button. */
@Composable
fun BactaCard(
    accent: Color,
    modifier: Modifier = Modifier,
    size: CardSize? = null,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(14.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = MaterialTheme.shapes.large
    val sized = modifier.fillMaxWidth().let { if (size != null) it.heightIn(min = size.height) else it }
    val body: @Composable () -> Unit = {
        Column(Modifier.cardFrame(accent, shape).padding(contentPadding), content = content)
    }
    val border = BorderStroke(1.dp, BactaPalette.Line)
    if (onClick != null) {
        Surface(onClick = onClick, modifier = sized, shape = shape, color = BactaPalette.Surface, border = border, content = body)
    } else {
        Surface(modifier = sized, shape = shape, color = BactaPalette.Surface, border = border, content = body)
    }
}

/** A section header: label, a hairline, and optional right-hand text. */
@Composable
fun SectionRail(label: UiText, accent: Color, modifier: Modifier = Modifier, right: UiText? = null) {
    Row(modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            label.asString(),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.labelMedium,
            color = accent,
        )
        Spacer(Modifier.width(10.dp))
        Spacer(Modifier.weight(1f).height(1.dp).background(BactaPalette.Line))
        if (right != null) {
            Spacer(Modifier.width(10.dp))
            Text(right.asString().uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        }
    }
}
