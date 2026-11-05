package io.github.bridgemouse.bacta.ui.recovery

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.briefing.briefingState
import io.github.bridgemouse.bacta.ui.format.Formatters
import io.github.bridgemouse.bacta.ui.title
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import java.time.Clock
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class RecoveryViewModel @Inject constructor(
    private val metrics: MetricsRepository,
    private val briefings: BriefingRepository,
    private val clock: Clock,
    private val fmt: Formatters,
) : ViewModel() {
    private val _state = MutableStateFlow<RecoveryUiState>(RecoveryUiState.Loading)
    val state: StateFlow<RecoveryUiState> = _state.asStateFlow()

    private var lastBriefing: Briefing? = null
    private var loading: Job? = null

    init {
        refresh()
    }

    fun refresh() {
        loading?.cancel()
        _state.update { if (it is RecoveryUiState.Content) it.copy(refreshing = true) else RecoveryUiState.Loading }
        loading = viewModelScope.launch {
            val (summary, trends, briefing) = coroutineScope {
                val s = async { metrics.summary() }
                val t = async { metrics.trends(RecoveryMetrics) }
                val b = async { briefings.briefing(Section.Recovery) }
                Triple(s.await(), t.await(), b.await())
            }
            val loaded = summary.getOrNull()
            if (loaded == null) {
                _state.value = RecoveryUiState.Error
                return@launch
            }
            val briefingState = briefingState(briefing, lastBriefing, clock, fmt)
            briefing.getOrNull()?.let { lastBriefing = it }
            _state.value = RecoveryUiState.Content(
                BriefingModel(Section.Recovery.title(), briefingState),
                toRecoveryContent(loaded, trends, fmt),
            )
        }
    }
}
