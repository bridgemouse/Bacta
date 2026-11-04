package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.ArcGauge
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip

/** An arc gauge card. [GaugeLayout.Side] puts a status chip and sentence beside it; [GaugeLayout.Hero] centers a large arc. */
@Composable
fun GaugeCard(
    model: GaugeModel,
    accent: Color,
    modifier: Modifier = Modifier,
    layout: GaugeLayout = GaugeLayout.Side,
) {
    val toneColor = model.tone?.let(BactaPalette::tone) ?: accent
    val progress = model.value?.let { (it / model.max).toFloat() }
    val semanticsModifier = modifier.semantics(mergeDescendants = true) {
        contentDescription = listOfNotNull(model.label, model.valueText ?: "no data").joinToString(", ")
        model.stateText?.let { stateDescription = it }
        model.value?.let { progressBarRangeInfo = ProgressBarRangeInfo(it.toFloat(), 0f..model.max.toFloat()) }
    }
    when (layout) {
        GaugeLayout.Side -> BactaCard(accent, semanticsModifier, size = CardSize.Bar) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                ArcGauge(progress, toneColor, Modifier.size(112.dp), strokeWidth = 9.dp) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(model.valueText ?: "—", style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text)
                        model.caption?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary) }
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    model.stateText?.let { Chip(it, toneColor) }
                    model.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.textSecondary) }
                }
            }
        }
        GaugeLayout.Hero -> BactaCard(accent, semanticsModifier) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(model.label.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
                model.rightLabel?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = toneColor) }
            }
            ArcGauge(progress, toneColor, Modifier.fillMaxWidth().height(165.dp), strokeWidth = 16.dp, sweep = 200f) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(model.valueText ?: "—", style = MaterialTheme.typography.displayLarge, color = BactaPalette.Text)
                    model.stateText?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = toneColor) }
                    model.caption?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary) }
                }
            }
        }
    }
}
