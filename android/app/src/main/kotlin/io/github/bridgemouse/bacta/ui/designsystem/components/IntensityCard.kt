package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip
import io.github.bridgemouse.bacta.ui.training.IntensityModel

/** The week's intensity as one bar: moderate minutes, then vigorous minutes (counted double), against the goal at the bar's end. */
@Composable
fun IntensityCard(model: IntensityModel, accent: Color, modifier: Modifier = Modifier) {
    val title = stringResource(R.string.label_intensity)
    val unit = stringResource(R.string.unit_min)
    val spoken = listOf(title, stringResource(R.string.value_with_unit, model.value.asString(), unit), model.goalLabel.asString(), model.legend.asString()).joinToString(", ")
    val vigorousColor = accent
    val moderateColor = accent.copy(alpha = 0.45f)
    BactaCard(accent, modifier.semantics(mergeDescendants = true) { contentDescription = spoken }) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(model.value.asString(), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text)
                Text(unit, Modifier.padding(start = 4.dp, bottom = 3.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.textSecondary)
            }
            if (model.met) Chip(io.github.bridgemouse.bacta.ui.UiText.of(R.string.goal_met), BactaPalette.Positive)
        }
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.fillMaxWidth().height(14.dp)) {
            val trackH = 10.dp.toPx()
            val top = (size.height - trackH) / 2f
            val radius = CornerRadius(trackH / 2)
            drawRoundRect(BactaPalette.Line, Offset(0f, top), Size(size.width, trackH), radius)
            val moderateW = size.width * model.moderateFraction
            val vigorousW = size.width * model.vigorousFraction
            if (moderateW > 0f) drawRoundRect(moderateColor, Offset(0f, top), Size(moderateW, trackH), radius)
            if (vigorousW > 0f) drawRoundRect(vigorousColor, Offset(moderateW, top), Size(vigorousW, trackH), radius)
            // The goal sits at the end of the bar.
            drawLine(BactaPalette.Text, Offset(size.width - 1.dp.toPx(), 0f), Offset(size.width - 1.dp.toPx(), size.height), 2.dp.toPx())
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(model.legend.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
            Text(model.goalLabel.asString(), style = MaterialTheme.typography.labelSmall, color = BactaPalette.Positive)
        }
    }
}
