package io.github.bridgemouse.bacta.ui.shell

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.SyncEvents
import io.github.bridgemouse.bacta.data.repository.SyncPhase
import io.github.bridgemouse.bacta.data.repository.SyncRepository
import io.github.bridgemouse.bacta.data.repository.SyncState
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeSync : SyncRepository {
    var startResult: Result<SyncState> = Result.success(SyncState(SyncPhase.Running, 0))
    val statuses = ArrayDeque<Result<SyncState>>()
    var startCalls = 0
    var statusResult: Result<SyncState> = Result.success(SyncState(SyncPhase.Idle, null))
    override suspend fun start(): Result<SyncState> { startCalls++; return startResult }
    override suspend fun status(): Result<SyncState> = statuses.removeFirstOrNull() ?: statusResult
}

private class FakeBriefings : BriefingRepository {
    var result: Result<Briefing?> = Result.success(null)
    override suspend fun briefing(section: Section) = result
}

@OptIn(ExperimentalCoroutinesApi::class)
class StatusBarViewModelTest {
    private val now = Instant.parse("2026-11-08T15:00:00Z")
    private val clock = Clock.fixed(now, ZoneId.of("UTC"))
    private val sync = FakeSync()
    private val briefings = FakeBriefings()
    private val events = SyncEvents()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun briefing(age: Duration) = Briefing(Tone.Positive, "H", "S", "B", "R", emptyList(), now.minus(age), null)
    private fun vm() = StatusBarViewModel(sync, events, briefings, clock)

    @Test
    fun mx4StatusFollowsHowFreshTheLastBriefingIs() = runTest {
        briefings.result = Result.success(briefing(Duration.ofHours(1)))
        assertEquals(Mx4Status.Online, vm().state.value.mx4)
        briefings.result = Result.success(briefing(Duration.ofHours(60)))
        assertEquals(Mx4Status.Stale, vm().state.value.mx4)
        briefings.result = Result.success(null)
        assertEquals(Mx4Status.NoBriefing, vm().state.value.mx4)
        briefings.result = Result.failure(IOException("down"))
        assertEquals(Mx4Status.Unknown, vm().state.value.mx4)
    }

    @Test
    fun startingASyncRunsPollsAndReportsDoneThenCompletes() = runTest {
        val completions = mutableListOf<Unit>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { events.completed.collect { completions += it } }
        val vm = vm()
        sync.statuses += Result.success(SyncState(SyncPhase.Running, 2))
        sync.statuses += Result.success(SyncState(SyncPhase.Done, 4))
        vm.startSync()
        assertEquals(SyncUi.Running(0), vm.state.value.sync)
        advanceTimeBy(StatusBarViewModel.POLL_MS + 1)
        assertEquals(SyncUi.Running(2), vm.state.value.sync)
        advanceTimeBy(StatusBarViewModel.POLL_MS)
        assertEquals(SyncUi.Done, vm.state.value.sync)
        assertEquals(1, completions.size)
        advanceTimeBy(StatusBarViewModel.RESET_MS + 1)
        assertEquals(SyncUi.Idle, vm.state.value.sync)
    }

    @Test
    fun aSecondTapWhileRunningDoesNothing() = runTest {
        val vm = vm()
        vm.startSync(); vm.startSync()
        assertEquals(1, sync.startCalls)
    }

    @Test
    fun aFailedStartShowsFailedThenRecovers() = runTest {
        sync.startResult = Result.failure(IOException("down"))
        val vm = vm()
        vm.startSync()
        assertEquals(SyncUi.Failed, vm.state.value.sync)
        advanceTimeBy(StatusBarViewModel.RESET_MS + 1)
        assertEquals(SyncUi.Idle, vm.state.value.sync)
    }

    @Test
    fun aPollThatErrorsKeepsTheSyncRunning() = runTest {
        val vm = vm()
        sync.statuses += Result.failure(IOException("blip"))
        sync.statuses += Result.success(SyncState(SyncPhase.Error, null))
        vm.startSync()
        advanceTimeBy(StatusBarViewModel.POLL_MS + 1)
        assertIs<SyncUi.Running>(vm.state.value.sync)
        advanceTimeBy(StatusBarViewModel.POLL_MS)
        assertEquals(SyncUi.Failed, vm.state.value.sync)
    }

    @Test
    fun aSyncAlreadyRunningOnTheServerIsPickedUpAtStartup() = runTest {
        sync.statusResult = Result.success(SyncState(SyncPhase.Running, 7))
        assertEquals(SyncUi.Running(7), vm().state.value.sync)
    }

    @Test
    fun askingAgainAfterLoginPicksUpTheBriefing() = runTest {
        briefings.result = Result.failure(IOException("401 before login"))
        val vm = vm()
        assertEquals(Mx4Status.Unknown, vm.state.value.mx4)
        briefings.result = Result.success(briefing(Duration.ofHours(1)))
        vm.refreshMx4()
        assertEquals(Mx4Status.Online, vm.state.value.mx4)
    }
}
