package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.training.ActivityDetailModel
import io.github.bridgemouse.bacta.ui.training.ActivityRowModel

/**
 * One logged activity: name and start, then duration, distance, heart rate and calories. A row with more to show opens on tap
 * (a button that announces expanded or collapsed) to reveal Training Effect, the activity's own zone split and a few facts.
 */
@Composable
fun ActivityRow(model: ActivityRowModel, accent: Color, modifier: Modifier = Modifier, initiallyExpanded: Boolean = false) {
    val title = model.title.asString()
    val subtitle = model.subtitle.asString()
    val stats = model.stats.map { it.asString() }
    val detail = model.detail
    var expanded by rememberSaveable(model.id) { mutableStateOf(initiallyExpanded) }
    val summary = if (detail != null) stringResource(R.string.cd_activity_row_expandable, title, subtitle, stats.joinToString(", "))
    else stringResource(R.string.cd_activity_row, title, subtitle, stats.joinToString(", "))
    val state = stringResource(if (expanded) R.string.state_expanded else R.string.state_collapsed)
    BactaCard(
        accent,
        modifier.animateContentSize().semantics(mergeDescendants = true) {
            contentDescription = summary
            if (detail != null) {
                role = Role.Button
                stateDescription = state
            }
        },
        onClick = detail?.let { { expanded = !expanded } },
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = BactaPalette.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            stats.forEach { Text(it, style = MaterialTheme.typography.labelMedium, color = BactaPalette.Text, maxLines = 1) }
        }
        if (detail != null && expanded) ActivityDetail(detail, accent)
    }
}

@Composable
private fun ActivityDetail(detail: ActivityDetailModel, accent: Color) {
    Spacer(Modifier.height(10.dp))
    HorizontalDivider(color = BactaPalette.Line)
    Spacer(Modifier.height(10.dp))
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        detail.effects.forEach { effect ->
            val color = effect.tone?.let(BactaPalette::tone) ?: accent
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(effect.label.asString(), Modifier.width(96.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary, maxLines = 1)
                Box(Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)).background(BactaPalette.Line)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(effect.fraction).background(color))
                }
                Text(effect.value.asString(), Modifier.width(40.dp).padding(start = 8.dp), style = MaterialTheme.typography.labelMedium, color = BactaPalette.Text, maxLines = 1)
            }
            Text(effect.band.asString(), Modifier.padding(start = 96.dp), style = MaterialTheme.typography.labelSmall, color = color)
        }
        detail.zones?.let { ZoneBars(it) }
        detail.facts.forEach { (label, value) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label.asString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary)
                Text(value.asString(), style = MaterialTheme.typography.labelMedium, color = BactaPalette.Text)
            }
        }
    }
}
