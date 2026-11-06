package io.github.bridgemouse.bacta.ui.logs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.LogEntry
import io.github.bridgemouse.bacta.data.repository.SettingsRepository
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface LogsUiState {
    data object Loading : LogsUiState
    data class Content(val sources: List<String>, val selected: String?, val entries: List<LogEntry>, val refreshing: Boolean = false) : LogsUiState
    data object Error : LogsUiState
}

@HiltViewModel
class LogsViewModel @Inject constructor(private val repo: SettingsRepository) : ViewModel() {
    private val _state = MutableStateFlow<LogsUiState>(LogsUiState.Loading)
    val state: StateFlow<LogsUiState> = _state.asStateFlow()

    private var selected: String? = null

    init {
        refresh()
    }

    /** Choosing the source that is already selected clears the filter. */
    fun select(source: String) {
        selected = if (selected == source) null else source
        refresh()
    }

    fun refresh() {
        val previous = _state.value as? LogsUiState.Content
        _state.value = previous?.copy(selected = selected, refreshing = true) ?: LogsUiState.Loading
        viewModelScope.launch {
            val (sources, entries) = coroutineScope {
                val s = async { previous?.sources?.takeIf { it.isNotEmpty() }?.let { Result.success(it) } ?: repo.logSources() }
                val e = async { repo.logs(selected, PAGE) }
                s.await() to e.await()
            }
            _state.value = entries.getOrNull()?.let { LogsUiState.Content(sources.getOrNull().orEmpty(), selected, it) } ?: LogsUiState.Error
        }
    }

    companion object {
        const val PAGE = 100
    }
}
