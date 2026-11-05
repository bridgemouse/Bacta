package io.github.bridgemouse.bacta.ui.sleep

import io.github.bridgemouse.bacta.data.prefs.TargetsRepository
import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.data.repository.NightHypnogram
import io.github.bridgemouse.bacta.data.repository.SleepRepository
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Targets
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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeMetrics : MetricsRepository {
    var summaryHandler: suspend () -> Result<Summary> = { Result.success(Summary(sleepScore = 95.0, sleepSeconds = 27480.0)) }
    var pointHandler: (Metric) -> Result<List<TrendPoint>> = { Result.success(listOf(TrendPoint(LocalDate.of(2026, 11, 3), 1.0), TrendPoint(LocalDate.of(2026, 11, 4), 2.0))) }
    var requested: Set<Metric> = emptySet()
    var days: Int? = null
    override suspend fun summary() = summaryHandler()
    override suspend fun points(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<TrendPoint>>> {
        requested = metrics; this.days = days
        return metrics.associateWith(pointHandler)
    }
    override suspend fun trends(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<Double>>> = emptyMap()
}

private class FakeBriefings : BriefingRepository {
    var handler: suspend () -> Result<Briefing?> = { Result.success(null) }
    var asked: Section? = null
    override suspend fun briefing(section: Section): Result<Briefing?> { asked = section; return handler() }
}

private class FakeSleep : SleepRepository {
    var handler: suspend () -> Result<NightHypnogram?> = { Result.success(null) }
    override suspend fun hypnogram() = handler()
}

private class FakeTargets(initial: Targets = Targets.Default) : TargetsRepository {
    val flow = MutableStateFlow(initial)
    override val targets: Flow<Targets> = flow
    override suspend fun update(transform: (Targets) -> Targets) { flow.value = transform(flow.value).sanitized() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SleepViewModelTest {
    private val clock = Clock.fixed(Instant.parse("2026-11-04T15:00:00Z"), ZoneId.of("UTC"))
    private val metrics = FakeMetrics()
    private val briefings = FakeBriefings()
    private val sleep = FakeSleep()
    private val targets = FakeTargets()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = SleepViewModel(metrics, briefings, sleep, targets, clock, testFormatters)

    @Test
    fun loadsTheSleepBriefingAndOnePointsBatch() = runTest {
        assertIs<SleepUiState.Content>(vm().state.value)
        assertEquals(Section.Sleep, briefings.asked)
        assertEquals(SleepMetrics, metrics.requested)
    }

    @Test
    fun oneSeriesFailingLeavesTheOthers() = runTest {
        metrics.pointHandler = { if (it == Metric.SleepHr) Result.failure(IOException("x")) else Result.success(listOf(TrendPoint(LocalDate.of(2026, 11, 3), 1.0), TrendPoint(LocalDate.of(2026, 11, 4), 2.0))) }
        val content = assertIs<SleepUiState.Content>(vm().state.value).content
        assertTrue(content.trends.none { it.rail.s() == "SLEEP HR" })
        assertTrue(content.trends.any { it.rail.s() == "SLEEP SCORE" })
    }

    @Test
    fun briefingStatesAreDistinct() = runTest {
        briefings.handler = { Result.success(null) }
        assertEquals(BriefingState.NoBriefing, assertIs<SleepUiState.Content>(vm().state.value).briefing.state)
        briefings.handler = { Result.failure(IOException("down")) }
        assertIs<BriefingState.Offline>(assertIs<SleepUiState.Content>(vm().state.value).briefing.state)
    }

    @Test
    fun aFailedHypnogramOnlyOmitsThatCard() = runTest {
        sleep.handler = { Result.failure(IOException("x")) }
        val content = assertIs<SleepUiState.Content>(vm().state.value).content
        assertEquals(null, content.hypnogram)
    }

    @Test
    fun refreshKeepsContentWhileLoading() = runTest {
        val vm = vm()
        val first = assertIs<SleepUiState.Content>(vm.state.value)
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        vm.refresh()
        val during = assertIs<SleepUiState.Content>(vm.state.value)
        assertTrue(during.refreshing)
        assertEquals(first.content, during.content)
        gate.complete(Result.success(Summary(sleepScore = 70.0)))
        val after = assertIs<SleepUiState.Content>(vm.state.value)
        assertFalse(after.refreshing)
        assertEquals("70", after.content.score.valueText)
    }

    @Test
    fun summaryFailureYieldsErrorAndRetryRecovers() = runTest {
        metrics.summaryHandler = { Result.failure(IOException("down")) }
        val vm = vm()
        assertEquals(SleepUiState.Error, vm.state.value)
        metrics.summaryHandler = { Result.success(Summary(sleepScore = 95.0)) }
        vm.refresh()
        assertIs<SleepUiState.Content>(vm.state.value)
    }

    @Test
    fun startsInLoading() = runTest {
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        assertEquals(SleepUiState.Loading, vm().state.value)
    }

    @Test
    fun changingTheTrendWindowChangesTheRequestAndCaption() = runTest {
        val vm = vm()
        assertEquals(7, metrics.days)
        targets.update { it.copy(trendDays = 30) }
        assertEquals(30, metrics.days)
        val content = assertIs<SleepUiState.Content>(vm.state.value).content
        assertEquals("30 days", content.trends.first().card.period.s())
    }

    @Test
    fun changingTheSleepTargetReloadsTheDebt() = runTest {
        metrics.pointHandler = { m ->
            if (m == Metric.SleepSeconds) Result.success(listOf(TrendPoint(LocalDate.of(2026, 11, 3), 400.0), TrendPoint(LocalDate.of(2026, 11, 4), 500.0)))
            else Result.success(emptyList())
        }
        val vm = vm()
        assertEquals("1h 20m", assertIs<SleepUiState.Content>(vm.state.value).content.debt?.value.s())
        targets.update { it.copy(sleepMinutes = 420) }
        assertEquals("20m", assertIs<SleepUiState.Content>(vm.state.value).content.debt?.value.s())
    }
}
