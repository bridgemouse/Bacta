package io.github.bridgemouse.bacta.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldBuffer
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.then
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedSecureTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.designsystem.viz.MX4Sigil
import io.github.bridgemouse.bacta.ui.designsystem.viz.SigilMood

private object DigitsOnly : InputTransformation {
    override fun TextFieldBuffer.transformInput() {
        if (!asCharSequence().all(Char::isDigit)) revertAllChanges()
    }
}

@Composable
fun LoginScreen(ui: LoginUiState, pin: TextFieldState, onSubmit: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 360.dp).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            MX4Sigil(SigilMood.Idle, 56.dp)
            Text(
                "Locked — enter PIN",
                style = MaterialTheme.typography.titleMedium,
                color = BactaPalette.Mx4,
                modifier = Modifier.semantics { heading() },
            )
            OutlinedSecureTextField(
                state = pin,
                modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.Password },
                label = { Text("PIN") },
                enabled = !ui.busy,
                isError = ui.error != null,
                inputTransformation = InputTransformation.maxLength(LoginUiState.MAX_PIN_LENGTH).then(DigitsOnly),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
                onKeyboardAction = KeyboardActionHandler { onSubmit() },
                supportingText = ui.error?.let { error ->
                    { Text(error.message(), Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
                },
            )
            Button(onClick = onSubmit, enabled = ui.canSubmit, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (ui.busy) "VERIFYING" else "UNLOCK")
            }
        }
    }
}

private fun LoginError.message() = when (this) {
    LoginError.WrongPin -> "Incorrect PIN"
    LoginError.Connection -> "Can't reach the server. Try again."
}

@Preview(widthDp = 411, heightDp = 700, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun LoginIdle() = BactaTheme { LoginScreen(LoginUiState(pin = "12"), rememberTextFieldState("12"), {}) }

@Preview(widthDp = 411, heightDp = 700, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun LoginError() = BactaTheme {
    LoginScreen(LoginUiState(error = io.github.bridgemouse.bacta.ui.login.LoginError.WrongPin), rememberTextFieldState(), {})
}

@Preview(widthDp = 411, heightDp = 700, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun LoginBusy() = BactaTheme { LoginScreen(LoginUiState(pin = "1234", busy = true), rememberTextFieldState("1234"), {}) }
