package io.github.bridgemouse.bacta.ui.training

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.prefs.TargetsRepository
import io.github.bridgemouse.bacta.data.repository.Activity
import io.github.bridgemouse.bacta.data.repository.ActivityRepository
import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.data.repository.WeekValue
import io.github.bridgemouse.bacta.data.repository.WeeklyIntensity
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

/** How far back the activity log looks, how many rows it shows, and how many weeks the weekly charts cover. */
private const val ActivityLogDays = 14
private const val ActivityLogRows = 10
private const val WeeklyChartWeeks = 6

@HiltViewModel
class TrainingViewModel @Inject constructor(
    private val metrics: MetricsRepository,
    private val activities: ActivityRepository,
    private val briefings: BriefingRepository,
    private val targets: TargetsRepository,
    private val clock: Clock,
    private val fmt: Formatters,
    private val syncEvents: io.github.bridgemouse.bacta.data.repository.SyncEvents,
) : ViewModel() {
    private val _state = MutableStateFlow<TrainingUiState>(TrainingUiState.Loading)
    val state: StateFlow<TrainingUiState> = _state.asStateFlow()

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
        val fast: Map<Metric, Result<List<TrendPoint>>>,
        val slow: Map<Metric, Result<List<TrendPoint>>>,
        val briefing: Result<Briefing?>,
        val activities: Result<List<Activity>>,
        val volume: Result<List<WeekValue>>,
        val avgHr: Result<List<WeekValue>>,
        val intensity: Result<WeeklyIntensity>,
    )

    fun refresh() {
        loading?.cancel()
        _state.update { if (it is TrainingUiState.Content) it.copy(refreshing = true) else TrainingUiState.Loading }
        loading = viewModelScope.launch {
            val current = targets.targets.first()
            val today = LocalDate.now(clock)
            val data = coroutineScope {
                val s = async { metrics.summary() }
                val f = async { metrics.points(TrainingFastMetrics, current.trendDays, today) }
                val sl = async { metrics.points(TrainingSlowMetrics, SlowTrendDays, today) }
                val b = async { briefings.briefing(Section.Training) }
                val a = async { activities.activities(ActivityLogDays) }
                val v = async { activities.weeklyVolume(WeeklyChartWeeks) }
                val h = async { activities.weeklyAvgHr(WeeklyChartWeeks) }
                val i = async { activities.weeklyIntensity() }
                Loaded(s.await(), f.await(), sl.await(), b.await(), a.await(), v.await(), h.await(), i.await())
            }
            val summary = data.summary.getOrNull()
            if (summary == null) {
                _state.value = TrainingUiState.Error
                return@launch
            }
            val briefingState = briefingState(data.briefing, lastBriefing, clock, fmt)
            data.briefing.getOrNull()?.let { lastBriefing = it }
            _state.value = TrainingUiState.Content(
                BriefingModel(Section.Training.title(), briefingState),
                toTrainingContent(
                    summary, data.fast, data.slow,
                    data.activities.getOrNull().orEmpty().sortedByDescending { it.start }.take(ActivityLogRows),
                    data.volume.getOrNull().orEmpty(), data.avgHr.getOrNull().orEmpty(), data.intensity.getOrNull(), current, fmt,
                ),
            )
        }
    }
}
