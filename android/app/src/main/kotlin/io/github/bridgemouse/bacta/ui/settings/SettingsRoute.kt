package io.github.bridgemouse.bacta.ui.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsRoute(viewModel: SettingsViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    SettingsScreen(ui, SettingsActions(viewModel))
}

/** The view model's operations as one value, so the screen and its previews depend on a plain object rather than a ViewModel. */
class SettingsActions(
    val refresh: () -> Unit = {},
    val startEdit: (String) -> Unit = {},
    val cancelEdit: () -> Unit = {},
    val save: (String, String) -> Unit = { _, _ -> },
    val setTarget: (TargetField, String) -> Unit = { _, _ -> },
    val setTrendDays: (Int) -> Unit = {},
    val testConnection: () -> Unit = {},
    val openPin: () -> Unit = {},
    val closePin: () -> Unit = {},
    val changePin: (String, String) -> Unit = { _, _ -> },
    val dismissMessage: () -> Unit = {},
    val chooseCustomModel: () -> Unit = {},
) {
    constructor(vm: SettingsViewModel) : this(
        vm::refresh, vm::startEdit, vm::cancelEdit, vm::save, vm::setTarget, vm::setTrendDays, vm::testConnection, vm::openPin, vm::closePin, vm::changePin, vm::dismissMessage, vm::chooseCustomModel,
    )
}
