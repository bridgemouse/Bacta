package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import io.github.bridgemouse.bacta.ui.training.LoadRatioModel

/** Acute:chronic load on a track with Garmin's optimal zone shaded and a marker at today's ratio. */
@Composable
fun LoadRatioCard(model: LoadRatioModel, accent: Color, modifier: Modifier = Modifier) {
    val stateColor = model.state?.tone?.let(BactaPalette::tone) ?: accent
    val title = stringResource(R.string.load_ratio_title)
    val spoken = listOfNotNull(title, model.value.asString(), model.state?.text?.asString(), model.caption.asString(), model.zoneLabel.asString()).joinToString(", ")
    BactaCard(accent, modifier.semantics(mergeDescendants = true) { contentDescription = spoken }) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(model.value.asString(), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text)
            model.state?.let { Chip(it.text, stateColor) }
        }
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.fillMaxWidth().height(16.dp)) {
            val trackH = 8.dp.toPx()
            val top = (size.height - trackH) / 2f
            val radius = CornerRadius(trackH / 2)
            drawRoundRect(BactaPalette.Line, Offset(0f, top), Size(size.width, trackH), radius)
            drawRoundRect(
                BactaPalette.Positive.copy(alpha = 0.3f),
                Offset(size.width * model.optimalStart, top),
                Size(size.width * (model.optimalEnd - model.optimalStart), trackH),
                radius,
            )
            val r = 7.dp.toPx()
            drawCircle(stateColor, r, Offset(r + (size.width - 2 * r) * model.position, size.height / 2f))
        }
        Row(Modifier.fillMaxWidth().height(24.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(model.caption.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
            Text(model.zoneLabel.asString(), style = MaterialTheme.typography.labelSmall, color = BactaPalette.Positive)
        }
    }
}
