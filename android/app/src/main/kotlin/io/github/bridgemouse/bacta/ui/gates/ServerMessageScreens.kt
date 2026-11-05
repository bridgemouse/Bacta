package io.github.bridgemouse.bacta.ui.gates

import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

/** Full-screen notice shown before the app proper: a title, an explanation and the actions that can fix it. */
@Composable
fun GateScreen(title: UiText, message: UiText, actions: @Composable ColumnScope.() -> Unit = {}) {
    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 480.dp).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                title.asString(),
                style = MaterialTheme.typography.titleLarge,
                color = BactaPalette.Mx4,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(message.asString(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.textSecondary, textAlign = TextAlign.Center)
            actions()
        }
    }
}

@Composable
fun GateButton(label: UiText, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.heightIn(min = 48.dp)) { Text(label.asString()) }
}

@Composable
fun AppTooOldScreen(minApp: String) = GateScreen(
    title = UiText.of(R.string.gate_update_title),
    message = UiText.of(R.string.gate_update_body, minApp),
)

@Composable
fun ServerUnreachableScreen(onRetry: () -> Unit) = GateScreen(
    title = UiText.of(R.string.gate_unreachable_title),
    message = UiText.of(R.string.gate_unreachable_body),
) { GateButton(UiText.of(R.string.action_retry), onRetry) }
