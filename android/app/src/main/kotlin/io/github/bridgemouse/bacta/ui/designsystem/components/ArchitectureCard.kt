package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.ArcRing
import io.github.bridgemouse.bacta.ui.designsystem.viz.ConcentricArcs
import io.github.bridgemouse.bacta.ui.designsystem.viz.arcAspectRatio
import io.github.bridgemouse.bacta.ui.sleep.ArchitectureModel

private const val SWEEP = 200f

/** The architecture score as one ring per stage around the score, with each stage's actual and target underneath. */
@Composable
fun ArchitectureCard(model: ArchitectureModel, accent: Color, modifier: Modifier = Modifier) {
    val toneColor = model.gauge.tone?.let(BactaPalette::tone) ?: accent
    val parts = model.parts.map { stringResource(R.string.cd_architecture_arcs, it.label.asString(), it.detail.asString()) }.joinToString(", ")
    val spoken = listOfNotNull(model.gauge.label.asString(), model.gauge.valueText, model.gauge.stateText?.asString(), parts).joinToString(", ")
    BactaCard(accent, modifier.semantics(mergeDescendants = true) { contentDescription = spoken }) {
        ConcentricArcs(
            model.parts.map { ArcRing(it.fraction, BactaPalette.stage(it.stage)) },
            Modifier.align(Alignment.CenterHorizontally).widthIn(max = 300.dp).fillMaxWidth().aspectRatio(arcAspectRatio(SWEEP)),
            sweep = SWEEP,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(model.gauge.valueText ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.displayMedium, color = BactaPalette.Text)
                model.gauge.stateText?.let { Text(it.asString(), style = MaterialTheme.typography.labelMedium, color = toneColor) }
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth().clearAndSetSemantics { }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            model.parts.forEach { part ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.width(20.dp).height(3.dp).background(BactaPalette.stage(part.stage)))
                    Text(part.label.asString().uppercase(), Modifier.padding(top = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
                    Text(part.actual.asString(), style = MaterialTheme.typography.labelMedium, color = BactaPalette.Text, textAlign = TextAlign.Center)
                    Text(part.target.asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary, textAlign = TextAlign.Center)
                }
            }
        }
    }
}
