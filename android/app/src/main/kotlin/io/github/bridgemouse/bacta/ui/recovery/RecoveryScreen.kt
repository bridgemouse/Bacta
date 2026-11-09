package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.CardRow
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeCard
import io.github.bridgemouse.bacta.ui.designsystem.components.rowCard
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeLayout
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
import io.github.bridgemouse.bacta.ui.designsystem.components.InfoCatalog
import io.github.bridgemouse.bacta.ui.designsystem.components.InfoSheet
import io.github.bridgemouse.bacta.ui.designsystem.components.explains
import io.github.bridgemouse.bacta.ui.designsystem.components.rememberInfoState
import io.github.bridgemouse.bacta.ui.designsystem.components.RefreshableScroll
import io.github.bridgemouse.bacta.ui.designsystem.components.SectionRail
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTile
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCard
import io.github.bridgemouse.bacta.ui.shell.Tab

private val Accent = BactaPalette.accent(Section.Recovery)

@Composable
fun RecoveryScreen(ui: RecoveryUiState, tab: Tab, onRefresh: () -> Unit, modifier: Modifier = Modifier) {
    when (ui) {
        RecoveryUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.recovery_loading), modifier)
        RecoveryUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.recovery_error), modifier, onRetry = onRefresh)
        is RecoveryUiState.Content -> RecoveryContentView(ui, tab, onRefresh, modifier)
    }
}

@Composable
private fun RecoveryContentView(ui: RecoveryUiState.Content, tab: Tab, onRefresh: () -> Unit, modifier: Modifier) {
    val c = ui.content
    val info = rememberInfoState()
    InfoSheet(info)
    RefreshableScroll(ui.refreshing, onRefresh, modifier) {
        BriefingCard(ui.briefing, onRefresh = onRefresh)
        when (tab) {
            Tab.Overview -> {
                GaugeCard(c.readiness, Accent, Modifier.explains(InfoCatalog.RecoveryScore, info))
                HeadlineCard(c.hrv, Accent, Modifier.explains(InfoCatalog.Hrv, info))
                c.battery?.let { GaugeCard(it, Accent, Modifier.explains(InfoCatalog.BodyBattery, info), layout = GaugeLayout.Hero) }
                c.recoveryTime?.let { MeterCard(it, Accent, Modifier.explains(InfoCatalog.RecoveryTime, info)) }
                CardRow {
                    c.pair.forEach { card ->
                        val about = if ((card.label as? UiText.Res)?.id == R.string.metric_stress) InfoCatalog.Stress else InfoCatalog.RestingHr
                        MetricCard(card, Accent, rowCard().explains(about, info))
                    }
                }
                SectionRail(UiText.of(R.string.rail_overnight_vitals), Accent, right = UiText.of(R.string.rail_health_status))
                c.vitals.chunked(2).forEach { row ->
                    CardRow {
                        row.forEach { tile -> StatusTile(tile, Accent, vitalInfo(tile.label)?.let { rowCard().explains(it, info) } ?: rowCard()) }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
            Tab.Trends -> {
                if (c.trends.isEmpty()) {
                    StateMessage(StateKind.Empty, UiText.of(R.string.trend_none_yet))
                }
                c.trends.forEach { section ->
                    // A rail and its chart are one unit, so on a wide window they flow into the columns together.
                    androidx.compose.foundation.layout.Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(9.dp)) {
                        SectionRail(section.rail, Accent, right = section.card.period)
                        TrendCard(section.card, Accent)
                    }
                }
            }
        }
    }
}

/** Which explanation a vitals tile opens, from the label it carries. */
private fun vitalInfo(label: UiText): io.github.bridgemouse.bacta.ui.designsystem.components.InfoText? = when ((label as? UiText.Res)?.id) {
    R.string.metric_sleep_stress -> InfoCatalog.SleepStress
    R.string.metric_respiration -> InfoCatalog.Respiration
    R.string.metric_spo2 -> InfoCatalog.Spo2
    R.string.metric_sleep_hr -> InfoCatalog.SleepHr
    else -> null
}
