package io.github.bridgemouse.bacta.ui.sleep

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.prefs.TargetsRepository
import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.data.repository.NightHypnogram
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.data.repository.SleepRepository
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.briefing.briefingState
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.format.Formatters
import io.github.bridgemouse.bacta.ui.title
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class SleepViewModel @Inject constructor(
    private val metrics: MetricsRepository,
    private val briefings: BriefingRepository,
    private val sleep: SleepRepository,
    private val targets: TargetsRepository,
    private val clock: Clock,
    private val fmt: Formatters,
    private val syncEvents: io.github.bridgemouse.bacta.data.repository.SyncEvents,
) : ViewModel() {
    private val _state = MutableStateFlow<SleepUiState>(SleepUiState.Loading)
    val state: StateFlow<SleepUiState> = _state.asStateFlow()

    private var lastBriefing: Briefing? = null
    private var loading: Job? = null

    init {
        refresh()
        // A finished Garmin sync means new data: reload what this screen shows.
        viewModelScope.launch { syncEvents.completed.collect { refresh() } }
        // A changed target or chart window reloads the screen; the first emission is the one refresh() already read.
        viewModelScope.launch { targets.targets.drop(1).collect { refresh() } }
    }

    private class Loaded(
        val summary: Result<Summary>,
        val points: Map<Metric, Result<List<TrendPoint>>>,
        val briefing: Result<Briefing?>,
        val hypnogram: Result<NightHypnogram?>,
    )

    fun refresh() {
        loading?.cancel()
        _state.update { if (it is SleepUiState.Content) it.copy(refreshing = true) else SleepUiState.Loading }
        loading = viewModelScope.launch {
            val current = targets.targets.first()
            val today = LocalDate.now(clock)
            val data = coroutineScope {
                val s = async { metrics.summary() }
                val p = async { metrics.points(SleepMetrics, current.trendDays, today) }
                val b = async { briefings.briefing(Section.Sleep) }
                val h = async { sleep.hypnogram() }
                Loaded(s.await(), p.await(), b.await(), h.await())
            }
            val summary = data.summary.getOrNull()
            if (summary == null) {
                _state.value = SleepUiState.Error
                return@launch
            }
            val briefingState = briefingState(data.briefing, lastBriefing, clock, fmt)
            data.briefing.getOrNull()?.let { lastBriefing = it }
            _state.value = SleepUiState.Content(
                BriefingModel(Section.Sleep.title(), briefingState),
                toSleepContent(summary, data.points, data.hypnogram.getOrNull(), current, fmt, today),
            )
        }
    }
}
