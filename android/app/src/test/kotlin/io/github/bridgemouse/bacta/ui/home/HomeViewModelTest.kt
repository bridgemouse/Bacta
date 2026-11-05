package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.data.repository.BriefingRepository
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.MetricsRepository
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import java.io.IOException
import java.time.Clock
import java.time.Duration
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
    var summaryHandler: suspend () -> Result<Summary> = { Result.success(Summary(bodyBatteryCurrent = 64.0)) }
    var trendHandler: (Metric) -> Result<List<Double>> = { Result.success(listOf(1.0, 2.0)) }
    var requested: Set<Metric> = emptySet()
    override suspend fun summary() = summaryHandler()
    override suspend fun points(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<io.github.bridgemouse.bacta.data.repository.TrendPoint>>> =
        metrics.associateWith { Result.success(emptyList()) }
    override suspend fun trends(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<Double>>> {
        requested = metrics
        return metrics.associateWith(trendHandler)
    }
}

private class FakeBriefings : BriefingRepository {
    var handler: suspend () -> Result<Briefing?> = { Result.success(null) }
    var asked: Section? = null
    override suspend fun briefing(section: Section): Result<Briefing?> { asked = section; return handler() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
    private val now = Instant.parse("2026-11-03T15:00:00Z")
    private val clock = Clock.fixed(now, ZoneId.of("UTC"))
    private val metrics = FakeMetrics()
    private val briefings = FakeBriefings()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = HomeViewModel(metrics, briefings, clock, testFormatters)
    private fun briefing(age: Duration) = Briefing(Tone.Positive, "H", "S", "B", "R", emptyList(), now.minus(age), null)

    @Test
    fun loadingThenContent() = runTest {
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        val vm = vm()
        assertEquals(HomeUiState.Loading, vm.state.value)
        gate.complete(Result.success(Summary(bodyBatteryCurrent = 64.0)))
        val content = assertIs<HomeUiState.Content>(vm.state.value)
        assertEquals("64", content.tiles.first().value.s())
        assertEquals(Section.Home, briefings.asked)
        assertTrue(Metric.Hrv in metrics.requested)
    }

    @Test
    fun oneTrendFailingLeavesTheOthers() = runTest {
        metrics.trendHandler = { if (it == Metric.TrainingLoad) Result.failure(IOException("x")) else Result.success(listOf(1.0, 2.0)) }
        val content = assertIs<HomeUiState.Content>(vm().state.value)
        assertEquals(listOf(1.0, 2.0), content.tiles[0].trend)
        assertEquals(null, content.tiles[1].trend)
    }

    @Test
    fun noBriefingAndOfflineAreDistinctStates() = runTest {
        briefings.handler = { Result.success(null) }
        assertEquals(BriefingState.NoBriefing, assertIs<HomeUiState.Content>(vm().state.value).briefing.state)
        briefings.handler = { Result.failure(IOException("down")) }
        assertIs<BriefingState.Offline>(assertIs<HomeUiState.Content>(vm().state.value).briefing.state)
    }

    @Test
    fun staleBriefingCarriesItsAge() = runTest {
        briefings.handler = { Result.success(briefing(Duration.ofHours(40))) }
        val state = assertIs<HomeUiState.Content>(vm().state.value).briefing.state
        assertEquals("40h ago", assertIs<BriefingState.Stale>(state).age.s())
    }

    @Test
    fun offlineKeepsTheLastGoodBriefingAfterARefresh() = runTest {
        briefings.handler = { Result.success(briefing(Duration.ofHours(1))) }
        val vm = vm()
        briefings.handler = { Result.failure(IOException("down")) }
        vm.refresh()
        val state = assertIs<BriefingState.Offline>(assertIs<HomeUiState.Content>(vm.state.value).briefing.state)
        assertEquals("H", state.last?.headline)
    }

    @Test
    fun refreshReloadsAndKeepsOldContentWhileLoading() = runTest {
        val vm = vm()
        val first = assertIs<HomeUiState.Content>(vm.state.value)
        assertFalse(first.refreshing)
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        vm.refresh()
        val during = assertIs<HomeUiState.Content>(vm.state.value)
        assertTrue(during.refreshing)
        assertEquals(first.tiles, during.tiles)
        gate.complete(Result.success(Summary(bodyBatteryCurrent = 80.0)))
        val after = assertIs<HomeUiState.Content>(vm.state.value)
        assertFalse(after.refreshing)
        assertEquals("80", after.tiles.first().value.s())
    }

    @Test
    fun summaryFailureYieldsErrorAndRetryRecovers() = runTest {
        metrics.summaryHandler = { Result.failure(IOException("down")) }
        val vm = vm()
        assertEquals(HomeUiState.Error, vm.state.value)
        metrics.summaryHandler = { Result.success(Summary(bodyBatteryCurrent = 64.0)) }
        vm.refresh()
        assertIs<HomeUiState.Content>(vm.state.value)
    }
}
