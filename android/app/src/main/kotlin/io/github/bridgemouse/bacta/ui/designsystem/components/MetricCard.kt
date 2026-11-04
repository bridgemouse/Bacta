package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.material3.Text
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Ring
import io.github.bridgemouse.bacta.ui.designsystem.viz.Sparkline

/** A headline-number card: label, value, optional ring and trend. Used for system tiles and paired headlines. */
@Composable
fun MetricCard(
    model: MetricCardModel,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val spoken = listOfNotNull(model.label, model.value ?: "no data", model.unit, model.sub).joinToString(", ")
    BactaCard(
        accent = accent,
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
        size = CardSize.Pair,
        onClick = onClick,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            model.icon?.let {
                Image(it, contentDescription = null, Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(model.label.uppercase(), style = MaterialTheme.typography.labelSmall, color = accent)
            Spacer(Modifier.weight(1f))
            model.index?.let {
                Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    val valueStyle = MaterialTheme.typography.displaySmall
                    Text(
                        model.value ?: "—",
                        style = valueStyle,
                        color = BactaPalette.Text,
                        maxLines = 1,
                        autoSize = TextAutoSize.StepBased(minFontSize = 18.sp, maxFontSize = valueStyle.fontSize),
                    )
                    model.unit?.let {
                        Spacer(Modifier.width(4.dp))
                        Text(
                            it,
                            Modifier.padding(bottom = 3.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.textSecondary,
                        )
                    }
                }
                model.sub?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary)
                }
            }
            model.ring?.let { progress ->
                Ring(progress, accent, Modifier.size(54.dp)) {
                    model.ringText?.let { Text(it, style = MaterialTheme.typography.labelLarge, color = BactaPalette.Text) }
                }
            }
        }
        model.trend?.takeIf { it.size >= 2 }?.let {
            Spacer(Modifier.height(8.dp))
            Sparkline(it, accent, describeSeries(model.label, it, "7 days"), Modifier.fillMaxWidth().height(36.dp))
        }
    }
}
