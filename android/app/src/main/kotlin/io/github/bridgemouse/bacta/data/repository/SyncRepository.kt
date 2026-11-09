package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

enum class SyncPhase { Idle, Running, Done, Error }

/** [elapsedSeconds] is how long the server's current run has been going; null when none is. */
data class SyncState(val phase: SyncPhase, val elapsedSeconds: Int?)

interface SyncRepository {
    /** Asks the server to run the Garmin poller; if one is already running it just reports that. */
    suspend fun start(): Result<SyncState>
    suspend fun status(): Result<SyncState>
}

class DefaultSyncRepository @Inject constructor(private val api: BactaApi) : SyncRepository {
    override suspend fun start(): Result<SyncState> = resultOf { api.startSync().toState() }
    override suspend fun status(): Result<SyncState> = resultOf { api.syncStatus().toState() }
}

private fun io.github.bridgemouse.bacta.data.network.SyncStateDto.toState() = SyncState(
    phase = when (status) {
        "running" -> SyncPhase.Running
        "done" -> SyncPhase.Done
        "error" -> SyncPhase.Error
        else -> SyncPhase.Idle
    },
    elapsedSeconds = elapsed,
)

/** Emits when a sync finishes, so every screen can reload the data it shows. */
@Singleton
class SyncEvents @Inject constructor() {
    private val _completed = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val completed: SharedFlow<Unit> = _completed.asSharedFlow()

    fun emitCompleted() {
        _completed.tryEmit(Unit)
    }
}
