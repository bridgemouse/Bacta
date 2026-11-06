package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip

/** A labelled linear meter with a position marker (for example, recovery time against a 72 h scale). */
@Composable
fun MeterCard(model: MeterModel, accent: Color, modifier: Modifier = Modifier) {
    val toneColor = model.tone?.let(BactaPalette::tone) ?: accent
    val noData = stringResource(R.string.cd_no_data)
    val stateText = model.stateText?.asString()
    val spoken = listOfNotNull(model.label.asString(), model.value?.asString() ?: noData, model.unit?.asString()).joinToString(", ")
    BactaCard(
        accent = accent,
        modifier = modifier.semantics(mergeDescendants = true) {
            contentDescription = spoken
            stateText?.let { stateDescription = it }
        },
        size = CardSize.Tile,
    ) {
        Text(model.label.asString().uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(model.value?.asString() ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text, maxLines = 1)
            model.unit?.let {
                Spacer(Modifier.width(4.dp))
                Text(it.asString(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary, maxLines = 1)
            }
            Spacer(Modifier.weight(1f))
            model.stateText?.let {
                Spacer(Modifier.width(8.dp))
                Chip(it, toneColor)
            }
        }
        Spacer(Modifier.height(10.dp))
        Box(
            Modifier.fillMaxWidth().height(14.dp).drawWithCache {
                val trackH = 8.dp.toPx()
                val top = (size.height - trackH) / 2f
                val pos = model.position?.coerceIn(0f, 1f)
                onDrawBehind {
                    drawRoundRect(BactaPalette.Line, Offset(0f, top), Size(size.width, trackH), CornerRadius(trackH / 2))
                    if (pos != null) {
                        drawRoundRect(toneColor.copy(alpha = 0.45f), Offset(0f, top), Size(size.width * pos, trackH), CornerRadius(trackH / 2))
                        drawCircle(toneColor, 7.dp.toPx(), Offset(7.dp.toPx() + (size.width - 14.dp.toPx()) * pos, size.height / 2f))
                    }
                }
            },
        )
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            model.startLabel?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary) }
            model.zoneLabel?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = BactaPalette.Positive) }
            model.endLabel?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary) }
        }
    }
}
