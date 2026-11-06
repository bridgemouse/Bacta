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
import io.github.bridgemouse.bacta.ui.UiText

// Synthetic data only: this file is the design-system gallery, never real health values.
// Its literals are exempt from the hardcoded-text ratchet: it is preview content, not app copy.

private fun t(text: String): UiText = UiText.Literal(text)

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
    BriefingCard(BriefingModel(t("Home"), BriefingState.Live(live, t("NOV 3 · 14:11"))), onRefresh = {})
    SectionRail(t("SYSTEMS"), a, right = t("3 ONLINE"))
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(
            MetricCardModel(t("Recovery"), t("74"), t("battery"), t("HRV ↑ 62ms"), trend = listOf(50.0, 54.0, 49.0, 57.0, 55.0, 60.0, 66.0, 74.0), index = "01"),
            BactaPalette.accent(Section.Recovery), Modifier.weight(1f), onClick = {},
        )
        MetricCard(
            MetricCardModel(t("Training"), t("342"), t("load"), t("Productive"), trend = listOf(280.0, 300.0, 260.0, 320.0, 340.0, 310.0, 330.0, 342.0), index = "02"),
            BactaPalette.accent(Section.Training), Modifier.weight(1f), onClick = {},
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(
            MetricCardModel(t("Sleep"), t("7h 45m"), null, t("Score 84"), ring = 0.84f, ringText = t("84"), index = "03"),
            BactaPalette.accent(Section.Sleep), Modifier.weight(1f), onClick = {},
        )
        MetricCard(
            MetricCardModel(t("Training status"), null, null, t("No data yet"), index = "04"),
            BactaPalette.accent(Section.Training), Modifier.weight(1f), onClick = {},
        )
    }
}

@Preview(widthDp = 412, heightDp = 1900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogRecovery() = CatalogPage {
    val a = BactaPalette.accent(Section.Recovery)
    SectionRail(t("READINESS"), a, right = t("SYNTHESIZED"))
    GaugeCard(
        GaugeModel(t("Recovery score"), 78.0, 100.0, "78", caption = t("/ 100"), stateText = t("READY"),
            description = t("Systems restored. Cleared for a high-intensity session today.")),
        a,
    )
    HeadlineCard(
        HeadlineModel(
            t("HRV · last night"), "62", t("ms"), delta = DeltaModel(t("▲ 4 ms"), DeltaDirection.Good), sub = t("vs 58ms week avg"),
            chips = listOf(ChipModel(t("IN RANGE"), Tone.Positive), ChipModel(t("→ STABLE"), Tone.Caution)),
            series = listOf(54.0, 56.0, 55.0, 58.0, 60.0, 59.0, 62.0), average = 58.0, band = 48.0..72.0,
            footnote = t("baseline 48–72ms · 7d avg 58ms"),
        ),
        a,
    )
    GaugeCard(
        GaugeModel(t("Body battery · today"), 74.0, 100.0, "74", caption = t("WAKE 92%"), stateText = t("MODERATE"), tone = Tone.Caution, rightLabel = t("-18 used")),
        a, layout = GaugeLayout.Hero,
    )
    MeterCard(MeterModel(t("Recovery time"), t("0.3"), t("h"), t("FRESH"), Tone.Positive, 0.02f, t("0h"), t("72h"), t("ready zone 0–24h")), a)
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        MetricCard(MetricCardModel(t("Resting HR"), t("52"), t("bpm"), t("▲ 0.5 bpm"), trend = listOf(50.0, 51.0, 50.0, 52.0, 51.0, 52.0)), a, Modifier.weight(1f))
        MetricCard(MetricCardModel(t("Stress"), t("27"), t("avg"), t("▲ 1.6 · MODERATE"), trend = listOf(24.0, 26.0, 25.0, 28.0, 27.0, 27.0)), a, Modifier.weight(1f))
    }
    SectionRail(t("OVERNIGHT VITALS"), a, right = t("HEALTH STATUS"))
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        StatusTile(StatusTileModel(t("Sleep stress"), "18", t("avg"), t("LOW · rest zone"), Tone.Positive, listOf(17.0, 18.0, 18.0, 19.0, 18.0)), a, Modifier.weight(1f))
        StatusTile(StatusTileModel(t("Respiration"), "14.5", t("br/m"), t("12–20 normal"), Tone.Positive, listOf(14.0, 14.2, 14.1, 14.6, 14.5)), a, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        StatusTile(StatusTileModel(t("SpO₂"), "96", t("%"), t("normal"), Tone.Positive, listOf(95.0, 96.0, 96.0, 95.0, 96.0)), a, Modifier.weight(1f))
        StatusTile(StatusTileModel(t("Sleep HR"), "44.1", t("bpm"), null, null, listOf(46.0, 45.0, 44.0, 45.0, 44.1)), a, Modifier.weight(1f))
    }
}

@Preview(widthDp = 412, heightDp = 760, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogTrends() = CatalogPage {
    val a = BactaPalette.accent(Section.Recovery)
    SectionRail(t("BODY BATTERY"), a, right = t("7 DAYS"))
    TrendCard(
        TrendCardModel(t("Body battery"), "74", series = listOf(88.0, 84.0, 90.0, 79.0, 92.0, 86.0, 90.5), kind = TrendKind.Bars,
            dayLabels = listOf("We", "Th", "Fr", "Sa", "Su", "Mo", "Tu"), caption = t("Wake value: how fully recharged sleep restored your energy reserve.")),
        a,
    )
    SectionRail(t("RESTING HR"), a, right = t("7 DAYS"))
    TrendCard(
        TrendCardModel(t("Resting HR"), "52", t("bpm"), series = listOf(50.0, 51.0, 50.0, 53.0, 52.0, 52.5, 52.0), delta = DeltaModel(t("▲ 0.5"), DeltaDirection.Bad),
            average = 51.5, caption = t("Lower is better. Measured during deepest sleep.")),
        a,
    )
    TrendCard(TrendCardModel(t("Sleep stress"), null, t("avg")), a)
}

@Preview(widthDp = 412, heightDp = 1500, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun CatalogStates() = CatalogPage {
    BriefingCard(BriefingModel(t("Home"), BriefingState.Loading))
    BriefingCard(BriefingModel(t("Home"), BriefingState.NoBriefing))
    BriefingCard(BriefingModel(t("Home"), BriefingState.Stale(live, t("3 DAYS OLD"))), onRefresh = {})
    BriefingCard(BriefingModel(t("Home"), BriefingState.Offline(live, t("last run NOV 1"))), onRefresh = {})
    BriefingCard(BriefingModel(t("Home"), BriefingState.Error), onRefresh = {})
    BactaCard(BactaPalette.accent(Section.Sleep)) { StateMessage(StateKind.Loading, t("Loading sleep data…")) }
    BactaCard(BactaPalette.accent(Section.Sleep)) { StateMessage(StateKind.Error, t("Couldn't reach the Bacta server."), onRetry = {}) }
}
