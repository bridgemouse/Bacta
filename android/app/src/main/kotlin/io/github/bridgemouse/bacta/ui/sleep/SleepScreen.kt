package io.github.bridgemouse.bacta.ui.sleep

import androidx.compose.foundation.layout.Arrangement
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
    RefreshableScroll(ui.refreshing, onRefresh, modifier) {
        BriefingCard(ui.briefing, onRefresh = onRefresh)
        when (tab) {
            Tab.Overview -> Overview(c)
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
private fun Overview(c: SleepContent) {
    val fmt = LocalFormatters.current
    val night = c.night?.let {
        UiText.of(if (it.stale) R.string.night_stale else R.string.night_of, fmt.shortDate(it.date))
    }
    SectionRail(UiText.of(R.string.rail_last_night), Accent, right = night)
    LastNightCard(c)
    if (c.stages.isNotEmpty()) {
        BactaCard(Accent) { StageBreakdown(c.stages) }
    }
    CardRow {
        BarStatCard(c.efficiency, Accent, rowCard())
        c.debt?.let { BarStatCard(it, Accent, rowCard()) } ?: Spacer(Modifier.weight(1f))
    }
    c.hypnogram?.let { HypnogramCard(it, Accent) }
    c.architecture?.let { arch ->
        SectionRail(UiText.of(R.string.rail_architecture_score), Accent)
        ArchitectureCard(arch, Accent)
    }
    if (c.vitals.isNotEmpty()) {
        SectionRail(UiText.of(R.string.rail_overnight_vitals), Accent, right = UiText.of(R.string.rail_while_asleep))
        c.vitals.chunked(2).forEach { row ->
            CardRow {
                row.forEach { StatusTile(it, Accent, rowCard()) }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun LastNightCard(c: SleepContent) {
    BactaCard(Accent) {
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
            }
            Ring(c.score.value?.let { (it / c.score.max).toFloat() } ?: 0f, Accent, Modifier.size(92.dp), strokeWidth = 6.dp) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.align(Alignment.Center)) {
                    Text(c.score.valueText ?: stringResource(R.string.value_missing), style = MaterialTheme.typography.headlineMedium, color = BactaPalette.Text)
                    c.score.stateText?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = Accent) }
                }
            }
        }
    }
}
