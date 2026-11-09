package io.github.bridgemouse.bacta.ui.training

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.tooling.preview.Preview
import io.github.bridgemouse.bacta.data.repository.Activity
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.data.repository.WeekValue
import io.github.bridgemouse.bacta.data.repository.WeeklyIntensity
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import io.github.bridgemouse.bacta.ui.format.LocaleFormatters
import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import io.github.bridgemouse.bacta.ui.format.MeasurementSystem
import io.github.bridgemouse.bacta.ui.shell.Tab
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import java.io.IOException
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Locale

// Synthetic data only.
private val formatters = LocaleFormatters(Locale.US, is24Hour = false) { MeasurementSystem.Imperial }
private val today = LocalDate.of(2026, 11, 4)

private val synthetic = Summary(
    trainingLoad = 300.0, trainingLoadMin = 200.0, trainingLoadMax = 375.0, trainingStatusN = 7.0, trainingStatusDate = "2026-11-03",
    vo2max = 48.0, fitnessAge = 36.0, fitnessAgeAchievable = 33.0,
    steps = 6400.0, stepsGoal = 10000.0, distanceMeters = 5200.0, caloriesTotal = 2300.0, caloriesActive = 520.0, floorsUp = 7.0, floorsGoal = 10.0,
    intensityModMin = 40.0, intensityVigMin = 20.0, hrZoneMinutes = listOf(12.0, 24.0, 18.0, 6.0, 1.0),
)

private fun week(vararg v: Double) = v.mapIndexed { i, x -> TrendPoint(today.minusDays((v.size - 1 - i).toLong()), x) }

private val fast: Map<Metric, Result<List<TrendPoint>>> = mapOf(
    Metric.TrainingLoad to Result.success(week(210.0, 260.0, 240.0, 310.0, 280.0, 330.0, 300.0)),
    Metric.IntensityVig to Result.success(week(10.0, 0.0, 25.0, 15.0, 0.0, 30.0, 20.0)),
    Metric.Steps to Result.success(week(8200.0, 6100.0, 9400.0, 7300.0, 10200.0, 5600.0, 6400.0)),
    Metric.CaloriesTotal to Result.success(week(2300.0, 2150.0, 2400.0, 2250.0, 2500.0, 2100.0, 2300.0)),
)
private val slow: Map<Metric, Result<List<TrendPoint>>> = mapOf(
    Metric.FitnessAge to Result.success(week(38.0, 38.0, 37.0, 37.0, 36.0, 36.0, 36.0)),
    Metric.Vo2Max to Result.success(week(46.0, 46.0, 47.0, 47.0, 48.0, 48.0, 48.0)),
)
private val volume = listOf(WeekValue("2026-39", 3.5), WeekValue("2026-40", 4.25), WeekValue("2026-41", 5.0), WeekValue("2026-42", 3.0), WeekValue("2026-43", 6.5), WeekValue("2026-44", 2.5))
private val avgHr = listOf(WeekValue("2026-39", 152.0), WeekValue("2026-40", 149.0), WeekValue("2026-41", 151.0), WeekValue("2026-42", 147.0), WeekValue("2026-43", 146.0), WeekValue("2026-44", 148.0))
private val activities = listOf(
    Activity(
        "1", "running", "Synthetic Run", LocalDateTime.of(2026, 11, 3, 7, 15), 1800.0, 5000.0, 152, 410,
        elevationM = 30.0, aerobicTe = 3.1, anaerobicTe = 0.4, recoveryHours = 12.0, zoneSeconds = listOf(60.0, 600.0, 900.0, 200.0, 40.0),
    ),
    Activity("2", "padel_sport", null, LocalDateTime.of(2026, 11, 2, 18, 0), 3600.0, null, 128, 520),
    Activity("3", "walking", null, LocalDateTime.of(2026, 11, 1, 12, 30), null, null, null, null),
)

private val briefing = BriefingModel(
    UiText.Literal("Training"),
    BriefingState.Live(BriefingContent(Tone.Positive, "Synthetic headline.", "Synthetic summary for layout only.", null), UiText.Literal("NOV 4 · 07:00")),
)

@Composable
private fun Frame(content: TrainingContent, tab: Tab) = BactaTheme {
    CompositionLocalProvider(LocalFormatters provides formatters) {
        TrainingScreen(TrainingUiState.Content(briefing, content), tab, onRefresh = {})
    }
}

private fun full() = toTrainingContent(synthetic, fast, slow, activities, volume, avgHr, WeeklyIntensity(70.0, 20.0), Targets.Default, formatters)

@Preview(widthDp = 412, heightDp = 2300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingOverviewLoaded() = Frame(full(), Tab.Overview)

@Preview(widthDp = 412, heightDp = 1500, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingOverviewPartial() = Frame(
    toTrainingContent(
        Summary(trainingLoad = 150.0), fast.mapValues { Result.failure<List<TrendPoint>>(IOException("x")) }, slow.mapValues { Result.failure<List<TrendPoint>>(IOException("x")) },
        emptyList(), emptyList(), emptyList(), null, Targets.Default, formatters,
    ),
    Tab.Overview,
)

@Preview(widthDp = 412, heightDp = 2900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingTrendsLoaded() = Frame(full(), Tab.Trends)

@Preview(widthDp = 412, heightDp = 400, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingError() = BactaTheme { TrainingScreen(TrainingUiState.Error, Tab.Overview, onRefresh = {}) }

// The same screen at 1.3x font scale: labels and chips must wrap whole, never mid-word.
@Preview(widthDp = 412, heightDp = 2900, fontScale = 1.3f, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingOverviewLarge() = TrainingOverviewLoaded()

@Preview(widthDp = 412, heightDp = 560, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingActivityExpanded() = BactaTheme {
    CompositionLocalProvider(LocalFormatters provides formatters) {
        androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.padding(13.dp)) {
            io.github.bridgemouse.bacta.ui.designsystem.components.ActivityRow(full().activities.first(), io.github.bridgemouse.bacta.ui.designsystem.BactaPalette.accent(io.github.bridgemouse.bacta.domain.Section.Training), initiallyExpanded = true)
        }
    }
}

// An unfolded inner screen: expanded width, so the cards flow into two columns.
@Preview(widthDp = 1000, heightDp = 2000, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun TrainingOverviewWide() = TrainingOverviewLoaded()
