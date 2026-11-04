package io.github.bridgemouse.bacta.ui.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.shell.Tab

@Composable
fun HomeRoute(tab: Tab, onOpenSection: (Section) -> Unit, viewModel: HomeViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(ui, tab, viewModel::refresh, onOpenSection)
}
