package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
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
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Sparkline
import io.github.bridgemouse.bacta.ui.designsystem.viz.StatusDot

/** A compact vital: label with a status dot, value, a one-line reading and a small trend. */
@Composable
fun StatusTile(model: StatusTileModel, accent: Color, modifier: Modifier = Modifier) {
    val noData = stringResource(R.string.cd_no_data)
    val sub = model.sub?.asString()
    val spoken = listOfNotNull(model.label.asString(), model.value ?: noData, model.unit?.asString()).joinToString(", ")
    BactaCard(
        accent = accent,
        modifier = modifier.semantics(mergeDescendants = true) {
            contentDescription = spoken
            sub?.let { stateDescription = it }
        },
        size = CardSize.Pair,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
    ) {
        // With the card hint on, the dot steps left of the hint mark in the corner instead of sitting under it.
        Row(Modifier.fillMaxWidth().padding(end = infoCueEndInset()), verticalAlignment = Alignment.CenterVertically) {
            Text(model.label.asString().uppercase(), Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
            // The dot is always there so tiles line up; it is coloured by the band's tone, and muted where no band exists (for example sleep heart rate, which has no published normal range).
            StatusDot(model.tone?.let(BactaPalette::tone) ?: BactaPalette.TextMuted)
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(model.value ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text)
            model.unit?.let {
                Spacer(Modifier.width(4.dp))
                Text(it.asString(), Modifier.padding(bottom = 3.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary)
            }
        }
        sub?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary) }
        if (model.series.size >= 2) {
            Spacer(Modifier.height(6.dp))
            Sparkline(model.series, accent, describeSeries(LocalFormatters.current, model.label, model.series, model.period).asString(), Modifier.fillMaxWidth().height(28.dp))
        }
    }
}
