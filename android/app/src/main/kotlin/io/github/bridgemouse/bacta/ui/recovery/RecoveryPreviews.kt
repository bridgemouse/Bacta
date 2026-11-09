package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.ui.format.LocaleFormatters
import io.github.bridgemouse.bacta.ui.format.MeasurementSystem
import io.github.bridgemouse.bacta.ui.UiText
import java.util.Locale
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
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
    recoveryScore = 83.0, hrv = 62.0, hrvWeekAvg = 58.0, hrvBaselineLow = 48.0, hrvBaselineHigh = 72.0,
    bodyBatteryCurrent = 74.0, bodyBatteryWake = 92.0, recoveryTimeHours = 0.3, restingHr = 52.0, stressAvg = 27.0,
    sleepStress = 18.0, respAvg = 14.5, spo2Avg = 96.0, sleepHr = 44.1,
)

private val week = listOf(54.0, 56.0, 55.0, 58.0, 60.0, 59.0, 62.0)

private val syntheticTrends: Map<Metric, Result<List<Double>>> = Metric.entries.associateWith { m ->
    Result.success(week.map { it * (if (m == Metric.RecoveryScore || m == Metric.BodyBatteryWake) 1.4 else 1.0) / (if (m == Metric.RespAvg) 4.0 else 1.0) })
}

private val briefing = BriefingModel(
    UiText.Literal("Recovery"),
    BriefingState.Live(
        BriefingContent(Tone.Positive, "Synthetic headline for the preview.", "Synthetic summary sentence for layout only.", "Synthetic directive long enough to wrap onto a second and third line so the layout under the label can be checked.",
            body = "## Synthetic section\nA synthetic paragraph with **bold** text.\n- first synthetic point\n- second synthetic point\n### Detail\nAnother synthetic line.",
            flags = listOf("first synthetic flag", "second synthetic flag", "a third synthetic flag that is long enough to need more than one line on a phone")),
        UiText.Literal("NOV 3 · 09:00"),
    ),
)

@Composable
private fun Frame(summary: Summary, trends: Map<Metric, Result<List<Double>>>, tab: Tab) = BactaTheme {
    RecoveryScreen(
        RecoveryUiState.Content(briefing, toRecoveryContent(summary, trends, previewFormatters)),
        tab,
        onRefresh = {},
    )
}

@Preview(widthDp = 412, heightDp = 2300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryOverviewLoaded() = Frame(synthetic, syntheticTrends, Tab.Overview)

@Preview(widthDp = 412, heightDp = 1500, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryOverviewPartial() =
    Frame(Summary(recoveryScore = 70.0, restingHr = 52.0, respAvg = 14.5), syntheticTrends.mapValues { Result.failure<List<Double>>(IOException("x")) }, Tab.Overview)

@Preview(widthDp = 412, heightDp = 2600, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryTrendsLoaded() = Frame(synthetic, syntheticTrends, Tab.Trends)

// The same screen at 1.3x font scale: labels and chips must wrap whole, never mid-word.
@Preview(widthDp = 412, heightDp = 2900, fontScale = 1.3f, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryOverviewLarge() = RecoveryOverviewLoaded()

@Preview(widthDp = 412, heightDp = 1100, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryBriefingExpanded() = BactaTheme {
    androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.padding(13.dp)) {
        io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard(
            briefing, onRefresh = {}, initiallyExpanded = true,
        )
    }
}

// An unfolded inner screen: expanded width, so the cards flow into two columns.
@Preview(widthDp = 1000, heightDp = 2000, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun RecoveryOverviewWide() = RecoveryOverviewLoaded()
