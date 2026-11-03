package io.github.bridgemouse.bacta.ui.shell

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.viz.MX4Sigil
import io.github.bridgemouse.bacta.ui.designsystem.viz.SigilMood

/** Present but inert until MX-4 chat ships (Phase E2); announced as disabled instead of silently doing nothing. */
@Composable
fun AskDockButton(modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(48.dp)
            .clip(CircleShape)
            .border(1.dp, BactaPalette.Line, CircleShape)
            .alpha(0.5f)
            .semantics {
                role = Role.Button
                disabled()
                contentDescription = "Ask MX-4, not available yet"
            },
        contentAlignment = Alignment.Center,
    ) {
        MX4Sigil(SigilMood.Idle, 24.dp)
    }
}
