package io.github.bridgemouse.bacta.ui.sleep

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.bridgemouse.bacta.ui.shell.Tab

@Composable
fun SleepRoute(tab: Tab, viewModel: SleepViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    SleepScreen(ui, tab, viewModel::refresh)
}
