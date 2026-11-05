package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.ui.format.LocaleFormatters
import io.github.bridgemouse.bacta.ui.format.MeasurementSystem
import io.github.bridgemouse.bacta.ui.UiText
import java.util.Locale
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import io.github.bridgemouse.bacta.ui.shell.Tab
import java.io.IOException

private val previewFormatters = LocaleFormatters(Locale.US, is24Hour = false) { MeasurementSystem.Imperial }

private val synthetic = Summary(
    bodyBatteryCurrent = 64.0, hrv = 61.0, hrvWeekAvg = 58.0, recoveryScore = 83.0, sleepScore = 81.0,
    sleepSeconds = 27120.0, trainingLoad = 410.0, trainingStatusN = 4.0,
)

private val syntheticTrends: Map<Metric, Result<List<Double>>> = mapOf(
    Metric.BodyBatteryCurrent to Result.success(listOf(50.0, 54.0, 49.0, 57.0, 55.0, 60.0, 64.0)),
    Metric.TrainingLoad to Result.success(listOf(280.0, 300.0, 260.0, 320.0, 340.0, 310.0, 410.0)),
    Metric.RecoveryScore to Result.success(listOf(70.0, 72.0, 68.0, 75.0, 80.0, 79.0, 83.0)),
    Metric.Hrv to Result.success(listOf(55.0, 58.0, 57.0, 60.0, 59.0, 61.0, 61.0)),
    Metric.SleepScore to Result.success(listOf(78.0, 82.0, 75.0, 80.0, 84.0, 79.0, 81.0)),
    Metric.IntensityMod to Result.success(listOf(30.0, 45.0, 20.0, 60.0, 35.0, 50.0, 40.0)),
    Metric.IntensityVig to Result.success(listOf(5.0, 10.0, 0.0, 15.0, 8.0, 12.0, 10.0)),
)

private val briefing = BriefingModel(
    UiText.Literal("Home"),
    BriefingState.Live(
        BriefingContent(Tone.Positive, "Synthetic headline for the preview.", "Synthetic summary sentence for layout only.", "Synthetic directive."),
        UiText.Literal("NOV 3 · 09:00"),
    ),
)

private fun content(summary: Summary, trends: Map<Metric, Result<List<Double>>>, state: BriefingModel = briefing) =
    HomeUiState.Content(state, toTiles(summary, trends, previewFormatters), toTrendRows(summary, trends, previewFormatters))

@Composable
private fun Frame(ui: HomeUiState, tab: Tab) = BactaTheme { HomeScreen(ui, tab, onRefresh = {}, onOpenSection = {}) }

@Preview(widthDp = 412, heightDp = 760, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun HomeOverviewLoaded() = Frame(content(synthetic, syntheticTrends), Tab.Overview)

@Preview(widthDp = 412, heightDp = 760, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun HomeOverviewPartial() = Frame(
    content(
        Summary(sleepScore = 81.0, sleepSeconds = 27120.0),
        syntheticTrends.mapValues { Result.failure<List<Double>>(IOException("x")) },
        BriefingModel(UiText.Literal("Home"), BriefingState.Offline(null, null)),
    ),
    Tab.Overview,
)

@Preview(widthDp = 412, heightDp = 1100, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun HomeTrendsLoaded() = Frame(content(synthetic, syntheticTrends), Tab.Trends)

@Preview(widthDp = 412, heightDp = 500, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun HomeError() = Frame(HomeUiState.Error, Tab.Overview)
