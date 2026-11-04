package io.github.bridgemouse.bacta.ui.recovery

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.bridgemouse.bacta.ui.shell.Tab

@Composable
fun RecoveryRoute(tab: Tab, viewModel: RecoveryViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    RecoveryScreen(ui, tab, viewModel::refresh)
}
