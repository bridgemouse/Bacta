package io.github.bridgemouse.bacta.ui.training

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.bridgemouse.bacta.ui.shell.Tab

@Composable
fun TrainingRoute(tab: Tab, viewModel: TrainingViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    TrainingScreen(ui, tab, viewModel::refresh)
}
