package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.BarsChart
import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import io.github.bridgemouse.bacta.ui.training.StepsChartModel

/** Daily steps as bars with the goal as a dashed line, and how far today is from it. */
@Composable
fun StepsChartCard(model: StepsChartModel, accent: Color, modifier: Modifier = Modifier) {
    val title = stringResource(R.string.metric_steps)
    val description = describeSeries(LocalFormatters.current, io.github.bridgemouse.bacta.ui.UiText.Literal(title), model.series, model.period).asString()
    BactaCard(accent, modifier) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(stringResource(R.string.join_dot, title.uppercase(), model.period.asString().uppercase()), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
            model.status?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = BactaPalette.Positive) }
        }
        Spacer(Modifier.height(10.dp))
        BarsChart(model.series, accent, model.labels, description, Modifier.fillMaxWidth().height(96.dp), average = model.goal)
    }
}
