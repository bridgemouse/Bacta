package io.github.bridgemouse.bacta.ui.sleep

import androidx.compose.foundation.layout.Arrangement
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.ArchitectureCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BactaCard
import io.github.bridgemouse.bacta.ui.designsystem.components.CardRow
import io.github.bridgemouse.bacta.ui.designsystem.components.rowCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BarStatCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeCard
import io.github.bridgemouse.bacta.ui.designsystem.components.HypnogramCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
import io.github.bridgemouse.bacta.ui.designsystem.components.InfoCatalog
import io.github.bridgemouse.bacta.ui.designsystem.components.InfoSheet
import io.github.bridgemouse.bacta.ui.designsystem.components.explains
import io.github.bridgemouse.bacta.ui.designsystem.components.rememberInfoState
import io.github.bridgemouse.bacta.ui.designsystem.components.RefreshableScroll
import io.github.bridgemouse.bacta.ui.designsystem.components.SectionRail
import io.github.bridgemouse.bacta.ui.designsystem.components.StageBreakdown
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTile
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCard
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Ring
import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import io.github.bridgemouse.bacta.ui.shell.Tab

private val Accent = BactaPalette.accent(Section.Sleep)

@Composable
fun SleepScreen(ui: SleepUiState, tab: Tab, onRefresh: () -> Unit, modifier: Modifier = Modifier) {
    when (ui) {
        SleepUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.sleep_loading), modifier)
        SleepUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.sleep_error), modifier, onRetry = onRefresh)
        is SleepUiState.Content -> SleepContentView(ui, tab, onRefresh, modifier)
    }
}

@Composable
private fun SleepContentView(ui: SleepUiState.Content, tab: Tab, onRefresh: () -> Unit, modifier: Modifier) {
    val c = ui.content
    val info = rememberInfoState()
    InfoSheet(info)
    RefreshableScroll(ui.refreshing, onRefresh, modifier) {
        BriefingCard(ui.briefing, onRefresh = onRefresh)
        when (tab) {
            Tab.Overview -> Overview(c, info)
            Tab.Trends -> {
                if (c.trends.isEmpty()) StateMessage(StateKind.Empty, UiText.of(R.string.trend_none_yet))
                c.trends.forEach { section ->
                    SectionRail(section.rail, Accent, right = section.card.period)
                    TrendCard(section.card, Accent)
                }
            }
        }
    }
}

@Composable
private fun Overview(c: SleepContent, info: io.github.bridgemouse.bacta.ui.designsystem.components.InfoState) {
    val fmt = LocalFormatters.current
    val night = c.night?.let {
        UiText.of(if (it.stale) R.string.night_stale else R.string.night_of, fmt.shortDate(it.date))
    }
    SectionRail(UiText.of(R.string.rail_last_night), Accent, right = night)
    LastNightCard(c, Modifier.explains(InfoCatalog.SleepScore, info))
    if (c.stages.isNotEmpty()) {
        BactaCard(Accent) { StageBreakdown(c.stages) }
    }
    CardRow {
        BarStatCard(c.efficiency, Accent, rowCard().explains(InfoCatalog.SleepEfficiency, info))
        c.debt?.let { BarStatCard(it, Accent, rowCard().explains(InfoCatalog.SleepDebt, info)) } ?: Spacer(Modifier.weight(1f))
    }
    c.hypnogram?.let { HypnogramCard(it, Accent) }
    c.architecture?.let { arch ->
        SectionRail(UiText.of(R.string.rail_architecture_score), Accent)
        ArchitectureCard(arch, Accent, Modifier.explains(InfoCatalog.Architecture, info))
    }
    if (c.vitals.isNotEmpty()) {
        SectionRail(UiText.of(R.string.rail_overnight_vitals), Accent, right = UiText.of(R.string.rail_while_asleep))
        c.vitals.chunked(2).forEach { row ->
            CardRow {
                row.forEach { tile -> StatusTile(tile, Accent, sleepVitalInfo(tile.label)?.let { rowCard().explains(it, info) } ?: rowCard()) }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun LastNightCard(c: SleepContent, modifier: Modifier = Modifier) {
    BactaCard(Accent, modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.time_asleep), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
                Text(
                    c.asleep?.asString() ?: stringResource(R.string.value_missing),
                    style = MaterialTheme.typography.displayMedium,
                    color = BactaPalette.Text,
                    maxLines = 1,
                )
                c.inBed?.let { Text(it.asString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary) }
                c.efficiencyLine?.let { Text(it.asString(), style = MaterialTheme.typography.bodySmall, color = BactaPalette.Positive) }
            }
            Ring(c.score.value?.let { (it / c.score.max).toFloat() } ?: 0f, Accent, Modifier.size(92.dp), strokeWidth = 6.dp) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.align(Alignment.Center)) {
                    Text(c.score.valueText ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.headlineMedium, color = BactaPalette.Text)
                    c.score.stateText?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = Accent) }
                }
            }
        }
        val sleepStages = c.stages.filter { it.stage != io.github.bridgemouse.bacta.domain.SleepStage.Awake }
        if (sleepStages.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                sleepStages.forEach { Chip(UiText.of(R.string.stage_chip, it.label, it.minutes), BactaPalette.stage(it.stage)) }
            }
        }
    }
}

private fun sleepVitalInfo(label: UiText): io.github.bridgemouse.bacta.ui.designsystem.components.InfoText? = when ((label as? UiText.Res)?.id) {
    R.string.metric_heart_rate -> InfoCatalog.SleepHr
    R.string.metric_respiration -> InfoCatalog.Respiration
    R.string.metric_sleep_stress -> InfoCatalog.SleepStress
    R.string.metric_spo2 -> InfoCatalog.Spo2
    else -> null
}
