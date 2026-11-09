package io.github.bridgemouse.bacta.ui.sleep

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.NightHypnogram
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.domain.SleepStage
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
import java.io.IOException
import java.time.LocalDate
import java.util.Locale

// Synthetic data only.
private val formatters = LocaleFormatters(Locale.US, is24Hour = false) { MeasurementSystem.Imperial }
private val today = LocalDate.of(2026, 11, 4)

private val synthetic = Summary(
    sleepSeconds = 27000.0, sleepDeepSeconds = 4800.0, sleepLightSeconds = 16800.0, sleepRemSeconds = 5400.0, sleepAwakeSeconds = 480.0,
    sleepScore = 87.0, sleepHr = 51.0, sleepResp = 13.5, sleepStress = 12.0, sleepSpo2 = 96.0,
)

private fun week(vararg v: Double) = v.mapIndexed { i, x -> TrendPoint(today.minusDays((v.size - 1 - i).toLong()), x) }

private val points: Map<Metric, Result<List<TrendPoint>>> = mapOf(
    Metric.SleepSeconds to Result.success(week(430.0, 455.0, 400.0, 470.0, 440.0, 420.0, 446.0)),
    Metric.SleepScore to Result.success(week(78.0, 84.0, 72.0, 88.0, 81.0, 76.0, 87.0)),
    Metric.SleepHr to Result.success(week(49.0, 48.0, 50.0, 47.0, 48.0, 49.0, 47.0)),
    Metric.SleepResp to Result.success(week(13.0, 13.4, 13.2, 13.8, 13.1, 13.5, 13.5)),
    Metric.SleepStress to Result.success(week(14.0, 12.0, 16.0, 11.0, 13.0, 15.0, 12.0)),
)

private val hypnogram = NightHypnogram(
    listOf(2, 2, 3, 3, 3, 2, 2, 1, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 3, 2, 2, 1, 2, 0).map { level ->
        when (level) { 3 -> SleepStage.Deep; 2 -> SleepStage.Light; 1 -> SleepStage.Rem; else -> SleepStage.Awake }
    },
    startLocalMs = 1793746800000L, endLocalMs = 1793775600000L,
)

private val briefing = BriefingModel(
    UiText.Literal("Sleep"),
    BriefingState.Live(BriefingContent(Tone.Positive, "Synthetic headline.", "Synthetic summary for layout only.", null), UiText.Literal("NOV 4 · 07:00")),
)

@Composable
private fun Frame(content: SleepContent, tab: Tab) = BactaTheme {
    androidx.compose.runtime.CompositionLocalProvider(LocalFormatters provides formatters) {
        SleepScreen(SleepUiState.Content(briefing, content), tab, onRefresh = {})
    }
}

@Preview(widthDp = 412, heightDp = 2300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SleepOverviewLoaded() = Frame(toSleepContent(synthetic, points, hypnogram, Targets.Default, formatters, today), Tab.Overview)

@Preview(widthDp = 412, heightDp = 1100, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SleepOverviewPartial() = Frame(
    toSleepContent(Summary(sleepScore = 72.0, sleepSeconds = 21000.0), points.mapValues { Result.failure<List<TrendPoint>>(IOException("x")) }, null, Targets.Default, formatters, today),
    Tab.Overview,
)

@Preview(widthDp = 412, heightDp = 1900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SleepTrendsLoaded() = Frame(toSleepContent(synthetic, points, hypnogram, Targets.Default, formatters, today), Tab.Trends)

// The same screen at 1.3x font scale: labels and chips must wrap whole, never mid-word.
@Preview(widthDp = 412, heightDp = 2900, fontScale = 1.3f, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SleepOverviewLarge() = SleepOverviewLoaded()

// An unfolded inner screen: expanded width, so the cards flow into two columns.
@Preview(widthDp = 1000, heightDp = 2000, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SleepOverviewWide() = SleepOverviewLoaded()
