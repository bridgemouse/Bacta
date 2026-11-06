package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip
import io.github.bridgemouse.bacta.ui.designsystem.viz.DeltaText
import io.github.bridgemouse.bacta.ui.designsystem.viz.Sparkline

/** A larger single-metric card: value, delta, status chips and a trend with an optional baseline band. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun HeadlineCard(model: HeadlineModel, accent: Color, modifier: Modifier = Modifier) {
    val noData = stringResource(R.string.cd_no_data)
    val spoken = listOfNotNull(model.label.asString(), model.value ?: noData, model.unit?.asString(), model.delta?.text?.asString(), model.sub?.asString()).joinToString(", ")
    BactaCard(
        accent = accent,
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
        size = CardSize.Chart,
    ) {
        Text(model.label.asString().uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        if (model.chips.isNotEmpty()) {
            // Chips get their own line and wrap whole, so two of them never squeeze each other or the label.
            Spacer(Modifier.height(6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                model.chips.forEach { chip -> Chip(chip.text, chip.tone?.let(BactaPalette::tone) ?: accent) }
            }
        }
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(model.value ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displayMedium, color = BactaPalette.Text)
            model.unit?.let {
                Spacer(Modifier.width(4.dp))
                Text(it.asString(), Modifier.padding(bottom = 4.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary)
            }
            model.delta?.let {
                Spacer(Modifier.width(10.dp))
                DeltaText(it, Modifier.padding(bottom = 4.dp))
            }
        }
        model.sub?.let { Text(it.asString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary) }
        if (model.series.size >= 2) {
            Spacer(Modifier.height(10.dp))
            Sparkline(
                model.series, accent, describeSeries(LocalFormatters.current, model.label, model.series, model.period).asString(),
                Modifier.fillMaxWidth().height(64.dp),
                average = model.average,
                band = model.band,
            )
        }
        model.footnote?.let {
            Spacer(Modifier.height(6.dp))
            Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        }
    }
}
