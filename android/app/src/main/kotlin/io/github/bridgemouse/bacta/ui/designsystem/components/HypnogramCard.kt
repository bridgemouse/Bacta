package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Hypnogram
import io.github.bridgemouse.bacta.ui.designsystem.viz.StatusDot

private fun SleepStage.label(): UiText = UiText.of(
    when (this) {
        SleepStage.Deep -> R.string.stage_deep
        SleepStage.Light -> R.string.stage_light
        SleepStage.Rem -> R.string.stage_rem
        SleepStage.Awake -> R.string.stage_awake
    },
)

/** The night's stages as a stepped chart with its clock labels and a legend. */
@Composable
fun HypnogramCard(model: HypnogramModel, accent: Color, modifier: Modifier = Modifier) {
    val description = if (model.axisLabels.size >= 2) {
        stringResource(R.string.cd_hypnogram, model.axisLabels.first(), model.axisLabels.last())
    } else stringResource(R.string.cd_hypnogram_plain)
    BactaCard(accent = accent, modifier = modifier) {
        Text(
            stringResource(R.string.hypnogram_title).uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.textSecondary,
        )
        Spacer(Modifier.height(10.dp))
        Hypnogram(model.levels, description, Modifier.fillMaxWidth().height(96.dp))
        if (model.axisLabels.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                model.axisLabels.forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary) }
            }
        }
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf(SleepStage.Awake, SleepStage.Rem, SleepStage.Light, SleepStage.Deep).forEach { stage ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    StatusDot(BactaPalette.stage(stage), Modifier)
                    Text(stage.label().asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
                }
            }
        }
    }
}
