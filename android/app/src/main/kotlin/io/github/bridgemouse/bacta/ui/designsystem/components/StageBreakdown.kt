package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.StatusDot

/** A stacked bar of the night's stage shares with one labelled row per stage. */
@Composable
fun StageBreakdown(stages: List<StageItem>, modifier: Modifier = Modifier) {
    val shares = stages.filter { it.stage != SleepStage.Awake && it.percent > 0 }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (shares.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)).clearAndSetSemantics { }) {
                shares.forEach { Box(Modifier.weight(it.percent.toFloat()).fillMaxWidth().height(10.dp).background(BactaPalette.stage(it.stage))) }
            }
        }
        stages.forEach { item ->
            val label = item.label.asString()
            val minutes = item.minutes.asString()
            val spoken = if (item.stage == SleepStage.Awake) stringResource(R.string.cd_stage_row_plain, label, minutes)
            else stringResource(R.string.cd_stage_row, label, minutes, item.percent)
            Row(
                Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = spoken },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StatusDot(BactaPalette.stage(item.stage), Modifier)
                Spacer(Modifier.padding(start = 8.dp))
                Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = BactaPalette.Text)
                Text(minutes, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary)
                if (item.stage != SleepStage.Awake) {
                    Text(
                        stringResource(R.string.stage_percent, item.percent),
                        Modifier.padding(start = 12.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = BactaPalette.Text,
                    )
                }
            }
        }
    }
}
