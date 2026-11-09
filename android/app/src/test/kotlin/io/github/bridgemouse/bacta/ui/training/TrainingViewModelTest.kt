package io.github.bridgemouse.bacta.ui.training

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
    var summaryHandler: suspend () -> Result<Summary> = { Result.success(Summary(trainingLoad = 300.0, trainingLoadMin = 200.0, trainingLoadMax = 375.0)) }
    var pointHandler: (Metric) -> Result<List<TrendPoint>> = { Result.success(listOf(TrendPoint(LocalDate.of(2026, 11, 3), 1.0), TrendPoint(LocalDate.of(2026, 11, 4), 2.0))) }
    val calls = mutableListOf<Pair<Set<Metric>, Int>>()
    override suspend fun summary() = summaryHandler()
    override suspend fun points(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<TrendPoint>>> {
        calls += metrics to days
        return metrics.associateWith(pointHandler)
    }
    override suspend fun trends(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<Double>>> = emptyMap()
}

private class FakeActivities : ActivityRepository {
    var activitiesHandler: suspend () -> Result<List<Activity>> = { Result.success(emptyList()) }
    var volume: suspend () -> Result<List<WeekValue>> = { Result.success(listOf(WeekValue("2026-44", 5.0))) }
    var avgHr: suspend () -> Result<List<WeekValue>> = { Result.success(listOf(WeekValue("2026-44", 150.0))) }
    var intensity: suspend () -> Result<WeeklyIntensity> = { Result.success(WeeklyIntensity(60.0, 10.0)) }
    override suspend fun activities(days: Int) = activitiesHandler()
    override suspend fun weeklyVolume(weeks: Int) = volume()
    override suspend fun weeklyAvgHr(weeks: Int) = avgHr()
    override suspend fun weeklyIntensity() = intensity()
}

private class FakeBriefings : BriefingRepository {
    var handler: suspend () -> Result<Briefing?> = { Result.success(null) }
    var asked: Section? = null
    override suspend fun briefing(section: Section): Result<Briefing?> { asked = section; return handler() }
}

private class FakeTargets : TargetsRepository {
    val flow = MutableStateFlow(Targets.Default)
    override val targets: Flow<Targets> = flow
    override suspend fun update(transform: (Targets) -> Targets) { flow.value = transform(flow.value).sanitized() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class TrainingViewModelTest {
    private val clock = Clock.fixed(Instant.parse("2026-11-04T15:00:00Z"), ZoneId.of("UTC"))
    private val metrics = FakeMetrics()
    private val activities = FakeActivities()
    private val briefings = FakeBriefings()
    private val targets = FakeTargets()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private val events = io.github.bridgemouse.bacta.data.repository.SyncEvents()
    private fun vm() = TrainingViewModel(metrics, activities, briefings, targets, clock, testFormatters, events)

    @Test
    fun loadsTheTrainingBriefingAndTwoPointBatches() = runTest {
        assertIs<TrainingUiState.Content>(vm().state.value)
        assertEquals(Section.Training, briefings.asked)
        assertEquals(TrainingFastMetrics to 7, metrics.calls.first { it.first == TrainingFastMetrics })
        assertEquals(TrainingSlowMetrics to 30, metrics.calls.first { it.first == TrainingSlowMetrics })
    }

    @Test
    fun oneWeeklyCallFailingOnlyOmitsThatSection() = runTest {
        activities.volume = { Result.failure(IOException("x")) }
        val content = assertIs<TrainingUiState.Content>(vm().state.value).content
        assertTrue(content.trends.none { it.rail.s() == "WEEKLY VOLUME" })
        assertTrue(content.trends.any { it.rail.s() == "ACTIVITY HEART RATE" })
        assertEquals("80", content.intensity?.value.s())
    }

    @Test
    fun briefingStatesAreDistinct() = runTest {
        briefings.handler = { Result.success(null) }
        assertEquals(BriefingState.NoBriefing, assertIs<TrainingUiState.Content>(vm().state.value).briefing.state)
        briefings.handler = { Result.failure(IOException("down")) }
        assertIs<BriefingState.Offline>(assertIs<TrainingUiState.Content>(vm().state.value).briefing.state)
    }

    @Test
    fun refreshKeepsContentWhileLoading() = runTest {
        val vm = vm()
        val first = assertIs<TrainingUiState.Content>(vm.state.value)
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        vm.refresh()
        val during = assertIs<TrainingUiState.Content>(vm.state.value)
        assertTrue(during.refreshing)
        assertEquals(first.content, during.content)
        gate.complete(Result.success(Summary(trainingLoad = 250.0, trainingLoadMin = 200.0, trainingLoadMax = 375.0)))
        val after = assertIs<TrainingUiState.Content>(vm.state.value)
        assertFalse(after.refreshing)
        assertEquals("250", after.content.performance.load.value)
    }

    @Test
    fun summaryFailureYieldsErrorAndRetryRecovers() = runTest {
        metrics.summaryHandler = { Result.failure(IOException("down")) }
        val vm = vm()
        assertEquals(TrainingUiState.Error, vm.state.value)
        metrics.summaryHandler = { Result.success(Summary()) }
        vm.refresh()
        assertIs<TrainingUiState.Content>(vm.state.value)
    }

    @Test
    fun startsInLoading() = runTest {
        val gate = CompletableDeferred<Result<Summary>>()
        metrics.summaryHandler = { gate.await() }
        assertEquals(TrainingUiState.Loading, vm().state.value)
    }

    @Test
    fun changingTheWeeklyGoalAndWindowReloads() = runTest {
        val vm = vm()
        assertEquals("goal 150 min", assertIs<TrainingUiState.Content>(vm.state.value).content.intensity?.goalLabel.s())
        targets.update { it.copy(weeklyIntensityMinutes = 200, trendDays = 30) }
        assertEquals("goal 200 min", assertIs<TrainingUiState.Content>(vm.state.value).content.intensity?.goalLabel.s())
        assertEquals(30, metrics.calls.last { it.first == TrainingFastMetrics }.second)
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
