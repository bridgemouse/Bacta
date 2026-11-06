package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

/** A titled card holding setting rows, with a hairline between them. */
@Composable
fun SettingsGroup(title: UiText, accent: Color, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    SectionRail(title, accent)
    BactaCard(accent, modifier, contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
        content()
    }
}

/** One tappable setting: its label, current value and an optional explanation. At least 56 dp tall for touch. */
@Composable
fun SettingRow(
    label: UiText,
    value: UiText?,
    modifier: Modifier = Modifier,
    supporting: UiText? = null,
    supportingColor: Color? = null,
    onClick: (() -> Unit)? = null,
) {
    Column {
        Row(
            modifier.fillMaxWidth().heightIn(min = 56.dp).let { if (onClick != null) it.clickable(role = Role.Button, onClick = onClick) else it }.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(label.asString(), style = MaterialTheme.typography.bodyLarge, color = BactaPalette.Text)
                supporting?.let { Text(it.asString(), style = MaterialTheme.typography.bodySmall, color = supportingColor ?: MaterialTheme.colorScheme.textSecondary) }
            }
            value?.let {
                Text(
                    it.asString(),
                    Modifier.padding(start = 12.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        HorizontalDivider(color = BactaPalette.Line)
    }
}

/** A setting that is on or off; the whole row toggles and is announced as a switch with its state. */
@Composable
fun SettingSwitchRow(label: UiText, checked: Boolean, onCheckedChange: (Boolean) -> Unit, accent: Color, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val state = stringResource(if (checked) R.string.state_on else R.string.state_off)
    val spoken = stringResource(R.string.cd_setting_toggle, label.asString(), state)
    Column {
        Row(
            modifier.fillMaxWidth().heightIn(min = 56.dp)
                .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
                .semantics { contentDescription = spoken }
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label.asString(), Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, color = BactaPalette.Text)
            Switch(
                checked = checked,
                onCheckedChange = null,
                modifier = Modifier.clearAndSetSemantics { },
                enabled = enabled,
                colors = SwitchDefaults.colors(checkedTrackColor = accent, checkedThumbColor = BactaPalette.Base),
            )
        }
        HorizontalDivider(color = BactaPalette.Line)
    }
}
