package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.BarsChart
import io.github.bridgemouse.bacta.ui.designsystem.viz.DeltaText
import io.github.bridgemouse.bacta.ui.designsystem.viz.Sparkline

/** One metric over time: value and delta on the left, a line or bar chart on the right, optional caption below. */
@Composable
fun TrendCard(model: TrendCardModel, accent: Color, modifier: Modifier = Modifier) {
    val description = describeSeries(LocalFormatters.current, model.label, model.series, model.period).asString()
    Column(modifier) {
        BactaCard(accent = accent) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(Modifier.width(104.dp)) {
                    Text(model.label.asString().uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(model.value ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text)
                        model.unit?.let {
                            Spacer(Modifier.width(4.dp))
                            Text(it.asString(), Modifier.padding(bottom = 3.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary)
                        }
                    }
                    model.delta?.let { DeltaText(it) }
                }
                when {
                    model.series.size < 2 -> Text(
                        stringResource(R.string.trend_no_data),
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.textSecondary,
                    )
                    model.kind == TrendKind.Bars -> BarsChart(
                        model.series, accent, model.dayLabels, description,
                        Modifier.weight(1f).height(72.dp),
                    )
                    else -> Sparkline(
                        model.series, accent, description,
                        Modifier.weight(1f).height(56.dp),
                        average = model.average,
                    )
                }
            }
        }
        model.caption?.asString()?.let {
            Text(
                it,
                Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp).semantics { contentDescription = it },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.textSecondary,
            )
        }
    }
}
