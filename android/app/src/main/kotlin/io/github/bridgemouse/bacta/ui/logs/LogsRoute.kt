package io.github.bridgemouse.bacta.ui.logs

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun LogsRoute(viewModel: LogsViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    LogsScreen(ui, viewModel::select, viewModel::refresh)
}
