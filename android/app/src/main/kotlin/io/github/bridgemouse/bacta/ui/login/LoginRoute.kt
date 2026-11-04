package io.github.bridgemouse.bacta.ui.login

import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun LoginRoute(onLoggedIn: () -> Unit, viewModel: LoginViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    val pin = rememberTextFieldState()

    LaunchedEffect(pin) { snapshotFlow { pin.text.toString() }.collect(viewModel::onPinChanged) }
    LaunchedEffect(ui.pin) {
        if (pin.text.toString() != ui.pin) pin.setTextAndPlaceCursorAtEnd(ui.pin)
    }
    LaunchedEffect(ui.done) { if (ui.done) onLoggedIn() }

    LoginScreen(ui, pin, viewModel::onSubmit)
}
