package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeMetrics : MetricsRepository {
    var summaryHandler: suspend () -> Result<Summary> = { Result.success(Summary(recoveryScore = 83.0)) }
    var trendHandler: (Metric) -> Result<List<Double>> = { Result.success(listOf(1.0, 2.0, 3.0)) }
    var requested: Set<Metric> = emptySet()
    var trendCalls = 0
    override suspend fun summary() = summaryHandler()
    override suspend fun points(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<io.github.bridgemouse.bacta.data.repository.TrendPoint>>> =
        metrics.associateWith { Result.success(emptyList()) }
    override suspend fun trends(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<Double>>> {
        requested = metrics; trendCalls++
        return metrics.associateWith(trendHandler)
    }
}

private class FakeBriefings : BriefingRepository {
    var handler: suspend () -> Result<Briefing?> = { Result.success(null) }
    var asked: Section? = null
    override suspend fun briefing(section: Section): Result<Briefing?> { asked = section; return handler() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class RecoveryViewModelTest {
    private val clock = Clock.fixed(Instant.parse("2026-11-03T15:00:00Z"), ZoneId.of("UTC"))
    private val metrics = FakeMetrics()
    private val briefings = FakeBriefings()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private val events = io.github.bridgemouse.bacta.data.repository.SyncEvents()
    private fun vm() = RecoveryViewModel(metrics, briefings, clock, testFormatters, events)

    @Test
    fun loadsRecoveryBriefingAndOneTrendBatchForEveryMetricTheScreenUses() = runTest {
        assertIs<RecoveryUiState.Content>(vm().state.value)
        assertEquals(Section.Recovery, briefings.asked)
        assertEquals(1, metrics.trendCalls)
        assertEquals(RecoveryMetrics, metrics.requested)
        assertTrue(Metric.Hrv in RecoveryMetrics && Metric.SleepHr in RecoveryMetrics && Metric.Spo2Avg in RecoveryMetrics)
    }

    @Test
    fun oneTrendFailingLeavesTheOthers() = runTest {
        metrics.trendHandler = { if (it == Metric.Hrv) Result.failure(IOException("x")) else Result.success(listOf(1.0, 2.0, 3.0)) }
        val content = assertIs<RecoveryUiState.Content>(vm().state.value)
        assertTrue(content.trends.none { it.rail.s() == "HRV" })
        assertTrue(content.trends.any { it.rail.s() == "RESTING HR" })
    }

    @Test
    fun briefingStatesAreDistinct() = runTest {
        briefings.handler = { Result.success(null) }
        assertEquals(BriefingState.NoBriefing, assertIs<RecoveryUiState.Content>(vm().state.value).briefing.state)
        briefings.handler = { Result.failure(IOException("down")) }
        assertIs<BriefingState.Offline>(assertIs<RecoveryUiState.Content>(vm().state.value).briefing.state)
    }

    @Test
    fun refreshKeepsContentWhileLoading() = runTest {
        val vm = vm()
        val first = assertIs<RecoveryUiState.Content>(vm.state.value)
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        vm.refresh()
        val during = assertIs<RecoveryUiState.Content>(vm.state.value)
        assertTrue(during.refreshing)
        assertEquals(first.readiness, during.readiness)
        gate.complete(Result.success(Summary(recoveryScore = 50.0)))
        val after = assertIs<RecoveryUiState.Content>(vm.state.value)
        assertFalse(after.refreshing)
        assertEquals("50", after.readiness.valueText)
    }

    @Test
    fun summaryFailureYieldsErrorAndRetryRecovers() = runTest {
        metrics.summaryHandler = { Result.failure(IOException("down")) }
        val vm = vm()
        assertEquals(RecoveryUiState.Error, vm.state.value)
        metrics.summaryHandler = { Result.success(Summary(recoveryScore = 83.0)) }
        vm.refresh()
        assertIs<RecoveryUiState.Content>(vm.state.value)
    }

    @Test
    fun startsInLoading() = runTest {
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        assertEquals(RecoveryUiState.Loading, vm().state.value)
    }

    @Test
    fun aCompletedSyncReloadsTheScreen() = runTest {
        var loads = 0
        val original = metrics.summaryHandler
        metrics.summaryHandler = { loads++; original() }
        vm()
        assertEquals(1, loads)
        events.emitCompleted()
        assertEquals(2, loads)
    }
}
