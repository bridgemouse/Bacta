package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.training.ActivityRowModel

/** One logged activity: its name and start, then duration, distance, heart rate and calories in a single line of stats. */
@Composable
fun ActivityRow(model: ActivityRowModel, accent: Color, modifier: Modifier = Modifier) {
    val title = model.title.asString()
    val subtitle = model.subtitle.asString()
    val stats = model.stats.map { it.asString() }
    val spoken = stringResource(R.string.cd_activity_row, title, subtitle, stats.joinToString(", "))
    BactaCard(accent, modifier.semantics(mergeDescendants = true) { contentDescription = spoken }) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = BactaPalette.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            stats.forEach { Text(it, style = MaterialTheme.typography.labelMedium, color = BactaPalette.Text, maxLines = 1) }
        }
    }
}
