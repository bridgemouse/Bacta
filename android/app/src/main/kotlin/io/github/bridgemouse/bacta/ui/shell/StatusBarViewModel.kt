package io.github.bridgemouse.bacta.ui.shell

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.SyncEvents
import io.github.bridgemouse.bacta.data.repository.SyncPhase
import io.github.bridgemouse.bacta.data.repository.SyncRepository
import io.github.bridgemouse.bacta.data.repository.SyncState
import io.github.bridgemouse.bacta.domain.Freshness
import io.github.bridgemouse.bacta.domain.Section
import java.time.Clock
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** What the top bar's sync button shows. */
sealed interface SyncUi {
    data object Idle : SyncUi
    data class Running(val elapsedSeconds: Int) : SyncUi
    data object Done : SyncUi
    data object Failed : SyncUi
}

/**
 * MX-4's state as far as the app can tell: his last briefing's age. The server has no "online" signal of its own, so the app does not
 * claim one; [Unknown] (the server did not answer) hides the indicator.
 */
enum class Mx4Status { Unknown, Online, Stale, NoBriefing }

data class StatusBarState(val sync: SyncUi = SyncUi.Idle, val mx4: Mx4Status = Mx4Status.Unknown)

@HiltViewModel
class StatusBarViewModel @Inject constructor(
    private val sync: SyncRepository,
    private val events: SyncEvents,
    private val briefings: BriefingRepository,
    private val clock: Clock,
) : ViewModel() {
    private val _state = MutableStateFlow(StatusBarState())
    val state: StateFlow<StatusBarState> = _state.asStateFlow()

    private var polling: Job? = null

    init {
        refreshMx4()
        viewModelScope.launch {
            sync.status().getOrNull()?.takeIf { it.phase == SyncPhase.Running }?.let { running ->
                _state.update { it.copy(sync = SyncUi.Running(running.elapsedSeconds ?: 0)) }
                poll()
            }
        }
    }

    fun refreshMx4() {
        viewModelScope.launch {
            val result = briefings.briefing(Section.Home)
            val status = result.fold(
                onSuccess = { b ->
                    when {
                        b == null -> Mx4Status.NoBriefing
                        Freshness.of(b.generatedAt, clock.instant()) == Freshness.Fresh -> Mx4Status.Online
                        else -> Mx4Status.Stale
                    }
                },
                onFailure = { Mx4Status.Unknown },
            )
            _state.update { it.copy(mx4 = status) }
        }
    }

    fun startSync() {
        if (_state.value.sync is SyncUi.Running) return
        _state.update { it.copy(sync = SyncUi.Running(0)) }
        polling = viewModelScope.launch {
            val started = sync.start().getOrNull()
            if (started == null) {
                finish(SyncUi.Failed)
            } else {
                poll()
            }
        }
    }

    private suspend fun poll() {
        // Bounded by the number of checks rather than the wall clock, so a run the server never finishes still ends.
        repeat(MAX_POLLS) {
            delay(POLL_MS)
            val s: SyncState? = sync.status().getOrNull()
            when (s?.phase) {
                SyncPhase.Done -> { events.emitCompleted(); refreshMx4(); finish(SyncUi.Done); return }
                SyncPhase.Error -> { finish(SyncUi.Failed); return }
                SyncPhase.Running -> _state.update { it.copy(sync = SyncUi.Running(s.elapsedSeconds ?: 0)) }
                // Idle after a start means the server forgot the run; a failed poll is a blip. Keep waiting either way, up to the limit.
                else -> Unit
            }
        }
        finish(SyncUi.Failed)
    }

    private suspend fun finish(result: SyncUi) {
        _state.update { it.copy(sync = result) }
        delay(RESET_MS)
        _state.update { it.copy(sync = SyncUi.Idle) }
    }

    companion object {
        /** How often a running sync is checked, how long Done/Failed stays on the button, and how many checks (ten minutes' worth) before the app gives up on a run. */
        const val POLL_MS = 2_000L
        const val RESET_MS = 3_000L
        const val MAX_POLLS = 300
    }
}
