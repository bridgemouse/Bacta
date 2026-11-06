package io.github.bridgemouse.bacta.ui.shell

import io.github.bridgemouse.bacta.ui.title
import io.github.bridgemouse.bacta.ui.asString
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.navigation.BuiltSections
import io.github.bridgemouse.bacta.ui.navigation.Destination
import io.github.bridgemouse.bacta.ui.navigation.SecondaryDestinations

/** Lists only the sections that have a screen. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NavSheet(current: Section, onSelect: (Section) -> Unit, onSelectSecondary: (Destination) -> Unit, onDismiss: () -> Unit) {
    // Skipping the half-open stop keeps Logs and About on screen without a drag.
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = BactaPalette.Surface) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(bottom = 16.dp)) {
            Text(
                stringResource(R.string.nav_all_systems),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.textSecondary,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp).semantics { heading() },
            )
            BuiltSections.forEach { section ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .selectable(selected = section == current, role = Role.Tab, onClick = { onSelect(section) })
                        .padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(10.dp).background(BactaPalette.accent(section), CircleShape))
                    Spacer(Modifier.width(16.dp))
                    Text(
                        section.title().asString(),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (section == current) BactaPalette.accent(section) else BactaPalette.Text,
                    )
                }
            }
            Text(
                stringResource(R.string.nav_more),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.textSecondary,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp).semantics { heading() },
            )
            SecondaryDestinations.forEach { (destination, label) ->
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp).selectable(selected = false, role = Role.Button, onClick = { onSelectSecondary(destination) }).padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(label), style = MaterialTheme.typography.titleMedium, color = BactaPalette.Text)
                }
            }
        }
    }
}
