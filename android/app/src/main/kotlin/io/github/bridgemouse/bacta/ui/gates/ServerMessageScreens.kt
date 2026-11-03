package io.github.bridgemouse.bacta.ui.gates

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
fun GateScreen(title: String, message: String, actions: @Composable ColumnScope.() -> Unit = {}) {
    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 480.dp).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                color = BactaPalette.Mx4,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.textSecondary, textAlign = TextAlign.Center)
            actions()
        }
    }
}

@Composable
fun GateButton(label: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.heightIn(min = 48.dp)) { Text(label) }
}

@Composable
fun AppTooOldScreen(minApp: String) = GateScreen(
    title = "UPDATE REQUIRED",
    message = "This version of Bacta is too old for the server, which needs $minApp or newer. Open the Firebase App Tester app and install the latest update.",
)

@Composable
fun ServerUnreachableScreen(onRetry: () -> Unit) = GateScreen(
    title = "SERVER UNREACHABLE",
    message = "Bacta could not reach the server. Check that you are on the home network, then try again.",
) { GateButton("RETRY", onRetry) }
