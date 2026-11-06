package io.github.bridgemouse.bacta.ui.logs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.LogEntry
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.BactaCard
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

private val Accent = BactaPalette.Mx4

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogsScreen(ui: LogsUiState, onSelect: (String) -> Unit, onRefresh: () -> Unit, modifier: Modifier = Modifier) {
    when (ui) {
        LogsUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.logs_loading), modifier)
        LogsUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.logs_error), modifier, onRetry = onRefresh)
        is LogsUiState.Content -> Column(modifier.fillMaxSize()) {
            if (ui.sources.isNotEmpty()) {
                LazyRow(contentPadding = PaddingValues(horizontal = 13.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ui.sources) { source ->
                        FilterChip(selected = source == ui.selected, onClick = { onSelect(source) }, label = { Text(source) })
                    }
                }
            }
            PullToRefreshBox(isRefreshing = ui.refreshing, onRefresh = onRefresh, modifier = Modifier.fillMaxSize()) {
                if (ui.entries.isEmpty()) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { StateMessage(StateKind.Empty, UiText.of(R.string.logs_empty)) }
                } else {
                    // The full-screen list is the screen's own scroll container, so a lazy list is the right tool here (unlike the capped activity log).
                    LazyColumn(contentPadding = PaddingValues(13.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        items(ui.entries) { LogRow(it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LogRow(entry: LogEntry) {
    val tone = when (entry.level.lowercase()) {
        "error" -> Tone.Flag
        "warn", "warning" -> Tone.Caution
        else -> null
    }
    val spoken = stringResource(R.string.logs_entry, entry.source, entry.level, entry.message)
    BactaCard(Accent, Modifier.semantics(mergeDescendants = true) { contentDescription = spoken }) {
        Row {
            Text(entry.source, style = MaterialTheme.typography.labelSmall, color = Accent, modifier = Modifier.weight(1f))
            Text(entry.createdAt, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        }
        Text(entry.message, Modifier.padding(top = 4.dp), style = MaterialTheme.typography.bodySmall, color = tone?.let { BactaPalette.tone(it) } ?: BactaPalette.Text)
    }
}
