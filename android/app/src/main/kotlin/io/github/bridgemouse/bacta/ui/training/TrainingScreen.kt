package io.github.bridgemouse.bacta.ui.training

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.ActivityRow
import io.github.bridgemouse.bacta.ui.designsystem.components.BactaCard
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.CardRow
import io.github.bridgemouse.bacta.ui.designsystem.components.rowCard
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineCard
import io.github.bridgemouse.bacta.ui.designsystem.components.LoadRatioCard
import io.github.bridgemouse.bacta.ui.designsystem.components.IntensityCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
import io.github.bridgemouse.bacta.ui.designsystem.components.RefreshableScroll
import io.github.bridgemouse.bacta.ui.designsystem.components.SectionRail
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCard
import io.github.bridgemouse.bacta.ui.designsystem.components.ZoneBars
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.shell.Tab

private val Accent = BactaPalette.accent(Section.Training)

@Composable
fun TrainingScreen(ui: TrainingUiState, tab: Tab, onRefresh: () -> Unit, modifier: Modifier = Modifier) {
    when (ui) {
        TrainingUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.training_loading), modifier)
        TrainingUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.training_error), modifier, onRetry = onRefresh)
        is TrainingUiState.Content -> TrainingContentView(ui, tab, onRefresh, modifier)
    }
}

@Composable
private fun TrainingContentView(ui: TrainingUiState.Content, tab: Tab, onRefresh: () -> Unit, modifier: Modifier) {
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

// The log is capped at a handful of rows by the view model, so it sits in the screen's one scroll column; a LazyColumn nested in a vertical scroll would need an unbounded height.
@Composable
private fun Overview(c: TrainingContent) {
    c.status?.let { StatusBanner(it) }
    SectionRail(UiText.of(R.string.rail_performance), Accent, right = UiText.of(R.string.rail_current))
    HeadlineCard(c.performance.load, Accent)
    c.loadRatio?.let { LoadRatioCard(it, Accent) }
    CardRow {
        MetricCard(c.performance.fitnessAge, Accent, rowCard())
        MetricCard(c.performance.vo2max, Accent, rowCard())
    }
    c.intensity?.let {
        SectionRail(UiText.of(R.string.rail_intensity_week), Accent)
        IntensityCard(it, Accent)
    }
    c.zones?.let {
        SectionRail(UiText.of(R.string.rail_hr_zones), Accent, right = UiText.of(R.string.zones_today, it.totalMinutes))
        BactaCard(Accent) { ZoneBars(it.items) }
    }
    SectionRail(UiText.of(R.string.rail_daily_activity), Accent)
    // Tiles with a ring are taller than plain numbers, so they pair with each other and the plain ones pair together.
    c.daily.sortedBy { it.ring == null }.chunked(2).forEach { row ->
        CardRow {
            row.forEach { MetricCard(it, Accent, rowCard()) }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    }
    SectionRail(UiText.of(R.string.rail_activity_log), Accent, right = c.activities.takeIf { it.isNotEmpty() }?.let { UiText.of(R.string.activities_recent, it.size) })
    if (c.activities.isEmpty()) StateMessage(StateKind.Empty, UiText.of(R.string.activities_none))
    c.activities.forEach { ActivityRow(it, Accent) }
}

@Composable
private fun StatusBanner(status: StatusModel) {
    BactaCard(Accent) {
        Text(UiText.of(R.string.training_status_title).asString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.textSecondary)
        Text(status.value.asString(), style = MaterialTheme.typography.headlineMedium, color = BactaPalette.Text)
        status.sub?.let { Text(it.asString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.textSecondary) }
    }
}
