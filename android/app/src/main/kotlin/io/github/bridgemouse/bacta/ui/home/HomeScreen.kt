package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
import io.github.bridgemouse.bacta.ui.designsystem.components.RefreshableScroll
import io.github.bridgemouse.bacta.ui.designsystem.components.SectionRail
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCard
import io.github.bridgemouse.bacta.ui.navigation.BuiltSections
import io.github.bridgemouse.bacta.ui.shell.Tab

@Composable
fun HomeScreen(
    ui: HomeUiState,
    tab: Tab,
    onRefresh: () -> Unit,
    onOpenSection: (Section) -> Unit,
    modifier: Modifier = Modifier,
) {
    when (ui) {
        HomeUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.home_loading), modifier)
        HomeUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.home_error), modifier, onRetry = onRefresh)
        is HomeUiState.Content -> HomeContent(ui, tab, onRefresh, onOpenSection, modifier)
    }
}

@Composable
private fun HomeContent(
    ui: HomeUiState.Content,
    tab: Tab,
    onRefresh: () -> Unit,
    onOpenSection: (Section) -> Unit,
    modifier: Modifier,
) {
    val accent = BactaPalette.accent(Section.Home)
    RefreshableScroll(ui.refreshing, onRefresh, modifier) {
        BriefingCard(ui.briefing, onRefresh = onRefresh)
        when (tab) {
            Tab.Overview -> {
                SectionRail(UiText.of(R.string.rail_systems), accent, right = UiText.of(R.string.rail_systems_online, ui.tiles.count { it.value != null }))
                ui.tiles.zip(HomeTileSections).chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        row.forEach { (tile, section) ->
                            MetricCard(
                                model = tile,
                                accent = BactaPalette.accent(section),
                                modifier = Modifier.weight(1f),
                                onClick = if (section in BuiltSections) ({ onOpenSection(section) }) else null,
                            )
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
            Tab.Trends -> {
                SectionRail(UiText.of(R.string.rail_week), accent, right = UiText.of(R.string.rail_week_channels, ui.trends.count { it.series.isNotEmpty() }))
                ui.trends.zip(HomeTrendSections).forEach { (row, section) ->
                    TrendCard(row, BactaPalette.accent(section))
                }
            }
        }
    }
}
