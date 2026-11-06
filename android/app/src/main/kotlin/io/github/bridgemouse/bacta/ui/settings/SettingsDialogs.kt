package io.github.bridgemouse.bacta.ui.settings

import android.text.format.DateFormat
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedSecureTextField
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.PinChangeResult
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette

@Composable
fun TextEditDialog(title: UiText, edit: EditState, numeric: Boolean, secret: Boolean, hint: UiText?, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    var text by remember(edit.key) { mutableStateOf(edit.initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title.asString()) },
        text = {
            Column {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    singleLine = true,
                    isError = edit.error != null,
                    label = hint?.let { { Text(it.asString()) } },
                    keyboardOptions = KeyboardOptions(keyboardType = if (numeric) KeyboardType.Number else if (secret) KeyboardType.Password else KeyboardType.Text),
                    visualTransformation = if (secret) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
                    supportingText = edit.error?.let { { Text(it.asString()) } },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = { TextButton(onClick = { onSave(text) }, enabled = !edit.saving) { Text(stringResource(R.string.action_save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

/** One radio row per option; choosing one applies it and closes. */
@Composable
fun ChoiceDialog(title: UiText, options: List<Pair<String, UiText>>, selected: String?, error: UiText?, onChoose: (String) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title.asString()) },
        text = {
            Column(Modifier.selectableGroup()) {
                options.forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(selected = value == selected, role = Role.RadioButton, onClick = { onChoose(value) }),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = value == selected, onClick = null)
                        Text(label.asString(), Modifier.padding(start = 12.dp), style = MaterialTheme.typography.bodyLarge)
                    }
                }
                error?.let { Text(it.asString(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

/** The Material 3 dial, in 12 or 24 hour form according to the system clock setting; [initial] and the result are "HH:mm". */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun TimeDialog(title: UiText, initial: String, error: UiText?, onConfirm: (String) -> Unit, onDismiss: () -> Unit) {
    val parts = initial.split(':')
    val state = rememberTimePickerState(
        initialHour = parts.getOrNull(0)?.toIntOrNull() ?: 3,
        initialMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0,
        is24Hour = DateFormat.is24HourFormat(LocalContext.current),
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title.asString()) },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                TimePicker(state = state)
                error?.let { Text(it.asString(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm("%02d:%02d".format(state.hour, state.minute)) }) { Text(stringResource(R.string.action_ok)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun PinDialog(state: PinState, onChange: (String, String) -> Unit, onDismiss: () -> Unit) {
    val current = rememberTextFieldState()
    val new = rememberTextFieldState()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.security_change_pin)) },
        text = {
            Column {
                OutlinedSecureTextField(
                    state = current,
                    label = { Text(stringResource(R.string.pin_current)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    isError = state.error == PinChangeResult.WrongCurrent,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedSecureTextField(
                    state = new,
                    label = { Text(stringResource(R.string.pin_new)) },
                    supportingText = { Text(stringResource(R.string.pin_hint)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    isError = state.error == PinChangeResult.BadFormat,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                state.error?.let {
                    val message = when (it) {
                        PinChangeResult.WrongCurrent -> R.string.pin_wrong_current
                        PinChangeResult.BadFormat -> R.string.pin_bad_format
                        else -> R.string.pin_failed
                    }
                    Text(stringResource(message), Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = { onChange(current.text.toString(), new.text.toString()) }, enabled = !state.saving) { Text(stringResource(R.string.action_change)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel), color = BactaPalette.Text) } },
    )
}
