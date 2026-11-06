package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.training.ZoneItem

/** One horizontal bar per heart-rate zone, each filled to its share of the day's zone time. */
@Composable
fun ZoneBars(zones: List<ZoneItem>, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // One bar for the whole day, split by each zone's share, above the per-zone rows.
        Row(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(7.dp)).clearAndSetSemantics { }) {
            zones.filter { it.percent > 0 }.forEach { Box(Modifier.weight(it.percent.toFloat()).fillMaxHeight().background(BactaPalette.zone(it.zone))) }
        }
        zones.forEach { item ->
            val label = item.label.asString()
            val spoken = stringResource(R.string.cd_zone_row, label, item.minutes, item.percent)
            Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = spoken }, verticalAlignment = Alignment.CenterVertically) {
                Text(label, Modifier.width(84.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary, maxLines = 1)
                Box(Modifier.weight(1f).height(10.dp).clip(RoundedCornerShape(5.dp)).background(BactaPalette.Line)) {
                    if (item.percent > 0) {
                        Box(Modifier.fillMaxHeight().fillMaxWidth(item.percent / 100f).background(BactaPalette.zone(item.zone)))
                    }
                }
                Text(item.minutesText.asString(), Modifier.width(56.dp).padding(start = 8.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary, maxLines = 1)
                Text(
                    stringResource(R.string.stage_percent, item.percent),
                    Modifier.width(48.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = BactaPalette.Text,
                    maxLines = 1,
                )
            }
        }
    }
}
