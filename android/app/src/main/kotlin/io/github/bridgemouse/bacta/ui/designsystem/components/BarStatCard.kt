package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

/** A compact stat card with a progress bar, sized to sit two to a row. */
@Composable
fun BarStatCard(model: BarStatModel, accent: Color, modifier: Modifier = Modifier) {
    val color = model.tone?.let(BactaPalette::tone) ?: accent
    val noData = stringResource(R.string.cd_no_data)
    val spoken = listOfNotNull(model.label.asString(), model.value?.asString() ?: noData, model.caption?.asString()).joinToString(", ")
    BactaCard(accent, modifier.semantics(mergeDescendants = true) { contentDescription = spoken }, size = CardSize.Pair) {
        Text(model.label.asString().uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        Spacer(Modifier.height(6.dp))
        Text(model.value?.asString() ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displaySmall, color = BactaPalette.Text, maxLines = 1)
        model.fraction?.let {
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(progress = { it.coerceIn(0f, 1f) }, Modifier.fillMaxWidth(), color = color, trackColor = BactaPalette.Line, drawStopIndicator = {})
        }
        model.caption?.let { Text(it.asString(), Modifier.padding(top = 6.dp), style = MaterialTheme.typography.labelSmall, color = color) }
    }
}
