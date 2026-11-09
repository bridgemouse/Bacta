package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.UiText
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

enum class StateKind { Loading, Empty, Error }

/** Loading, empty or error feedback for a whole region. Errors offer a retry (48 dp minimum target). */
@Composable
fun StateMessage(kind: StateKind, message: UiText, modifier: Modifier = Modifier, onRetry: (() -> Unit)? = null) {
    Column(
        modifier.fullWidth().fillMaxWidth().padding(24.dp).semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (kind == StateKind.Loading) CircularProgressIndicator(color = BactaPalette.Mx4, strokeWidth = 2.dp)
        Text(
            message.asString(),
            style = MaterialTheme.typography.bodyMedium,
            color = if (kind == StateKind.Error) BactaPalette.Flag else MaterialTheme.colorScheme.textSecondary,
            textAlign = TextAlign.Center,
        )
        if (kind == StateKind.Error && onRetry != null) {
            OutlinedButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.action_retry)) }
        }
    }
}
