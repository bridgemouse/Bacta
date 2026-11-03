package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.components.BactaCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import io.github.bridgemouse.bacta.ui.designsystem.components.ChipModel
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeCard
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeLayout
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineCard
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.SectionRail
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTile
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCard
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import io.github.bridgemouse.bacta.ui.designsystem.components.formatDelta

// Synthetic data only: this file is the design-system gallery, never real health values.

private val live = BriefingContent(
    tone = Tone.Positive,
    headline = "All systems green.",
    summary = "Synthetic briefing for visual reference only. Recovery is high, sleep was solid, and training load sits in range.",
    directive = "Synthetic.",
)

@Composable
private fun CatalogPage(content: @Composable () -> Unit) {
    BactaTheme {
        Column(
            Modifier.fillMaxWidth().bactaTexture(BactaPalette.Mx4).padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) { content() }
    }
}

@Preview(widthDp = 412, heightDp = 860, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogHome() = CatalogPage {
    val a = BactaPalette.accent(Section.Home)
    BriefingCard(BriefingModel("Home", BriefingState.Live(live, "NOV 3 · 14:11")), onRefresh = {})
    SectionRail("SYSTEMS", a, right = "3 ONLINE")
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(
            MetricCardModel("Recovery", "74", "battery", "HRV ↑ 62ms", trend = listOf(50.0, 54.0, 49.0, 57.0, 55.0, 60.0, 66.0, 74.0), index = "01"),
            BactaPalette.accent(Section.Recovery), Modifier.weight(1f), onClick = {},
        )
        MetricCard(
            MetricCardModel("Training", "342", "load", "Productive", trend = listOf(280.0, 300.0, 260.0, 320.0, 340.0, 310.0, 330.0, 342.0), index = "02"),
            BactaPalette.accent(Section.Training), Modifier.weight(1f), onClick = {},
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(
            MetricCardModel("Sleep", "7h 45m", null, "Score 84", ring = 0.84f, ringText = "84", index = "03"),
            BactaPalette.accent(Section.Sleep), Modifier.weight(1f), onClick = {},
        )
        MetricCard(
            MetricCardModel("Training status", null, null, "No data yet", index = "04"),
            BactaPalette.accent(Section.Training), Modifier.weight(1f), onClick = {},
        )
    }
}

@Preview(widthDp = 412, heightDp = 1900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogRecovery() = CatalogPage {
    val a = BactaPalette.accent(Section.Recovery)
    val up = DeltaModel(formatDelta(4.0, 0).orEmpty(), DeltaDirection.Good)
    SectionRail("READINESS", a, right = "SYNTHESIZED")
    GaugeCard(
        GaugeModel("Recovery score", 78.0, 100.0, "78", caption = "/ 100", stateText = "READY",
            description = "Systems restored. Cleared for a high-intensity session today."),
        a,
    )
    HeadlineCard(
        HeadlineModel(
            "HRV · last night", "62", "ms", delta = DeltaModel("▲ 4 ms", DeltaDirection.Good), sub = "vs 58ms week avg",
            chips = listOf(ChipModel("IN RANGE", Tone.Positive), ChipModel("→ STABLE", Tone.Caution)),
            series = listOf(54.0, 56.0, 55.0, 58.0, 60.0, 59.0, 62.0), average = 58.0, band = 48.0..72.0,
            footnote = "baseline 48–72ms · 7d avg 58ms",
        ),
        a,
    )
    GaugeCard(
        GaugeModel("Body battery · today", 74.0, 100.0, "74", caption = "WAKE 92%", stateText = "MODERATE", tone = Tone.Caution, rightLabel = "-18 used"),
        a, layout = GaugeLayout.Hero,
    )
    MeterCard(MeterModel("Recovery time", "0.3", "h", "FRESH", Tone.Positive, 0.02f, "0h", "72h", "ready zone 0–24h"), a)
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(MetricCardModel("Resting HR", "52", "bpm", "▲ 0.5 bpm", trend = listOf(50.0, 51.0, 50.0, 52.0, 51.0, 52.0)), a, Modifier.weight(1f))
        MetricCard(MetricCardModel("Stress", "27", "avg", "▲ 1.6 · MODERATE", trend = listOf(24.0, 26.0, 25.0, 28.0, 27.0, 27.0)), a, Modifier.weight(1f))
    }
    SectionRail("OVERNIGHT VITALS", a, right = "HEALTH STATUS")
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        StatusTile(StatusTileModel("Sleep stress", "18", "avg", "LOW · rest zone", Tone.Positive, listOf(17.0, 18.0, 18.0, 19.0, 18.0)), a, Modifier.weight(1f))
        StatusTile(StatusTileModel("Respiration", "14.5", "br/m", "12–20 normal", Tone.Positive, listOf(14.0, 14.2, 14.1, 14.6, 14.5)), a, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        StatusTile(StatusTileModel("SpO₂", "96", "%", "normal", Tone.Positive, listOf(95.0, 96.0, 96.0, 95.0, 96.0)), a, Modifier.weight(1f))
        StatusTile(StatusTileModel("Sleep HR", "44.1", "bpm", null, null, listOf(46.0, 45.0, 44.0, 45.0, 44.1)), a, Modifier.weight(1f))
    }
}

@Preview(widthDp = 412, heightDp = 760, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogTrends() = CatalogPage {
    val a = BactaPalette.accent(Section.Recovery)
    SectionRail("BODY BATTERY", a, right = "7 DAYS")
    TrendCard(
        TrendCardModel("Body battery", "74", series = listOf(88.0, 84.0, 90.0, 79.0, 92.0, 86.0, 90.5), kind = TrendKind.Bars,
            dayLabels = listOf("We", "Th", "Fr", "Sa", "Su", "Mo", "Tu"), caption = "Wake value: how fully recharged sleep restored your energy reserve."),
        a,
    )
    SectionRail("RESTING HR", a, right = "7 DAYS")
    TrendCard(
        TrendCardModel("Resting HR", "52", "bpm", series = listOf(50.0, 51.0, 50.0, 53.0, 52.0, 52.5, 52.0), delta = DeltaModel("▲ 0.5", DeltaDirection.Bad),
            average = 51.5, caption = "Lower is better. Measured during deepest sleep."),
        a,
    )
    TrendCard(TrendCardModel("Sleep stress", null, "avg"), a)
}

@Preview(widthDp = 412, heightDp = 1500, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogStates() = CatalogPage {
    BriefingCard(BriefingModel("Home", BriefingState.Loading))
    BriefingCard(BriefingModel("Home", BriefingState.NoBriefing))
    BriefingCard(BriefingModel("Home", BriefingState.Stale(live, "3 DAYS OLD")), onRefresh = {})
    BriefingCard(BriefingModel("Home", BriefingState.Offline(live, "last run NOV 1")), onRefresh = {})
    BriefingCard(BriefingModel("Home", BriefingState.Error), onRefresh = {})
    BactaCard(BactaPalette.accent(Section.Sleep)) { StateMessage(StateKind.Loading, "Loading sleep data…") }
    BactaCard(BactaPalette.accent(Section.Sleep)) { StateMessage(StateKind.Error, "Couldn't reach the Bacta server.", onRetry = {}) }
}
