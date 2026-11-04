package io.github.bridgemouse.bacta.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingCard
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCard
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
        HomeUiState.Loading -> StateMessage(StateKind.Loading, "Loading your data…", modifier)
        HomeUiState.Error -> StateMessage(StateKind.Error, "Couldn't load your data. Check the connection and try again.", modifier, onRetry = onRefresh)
        is HomeUiState.Content -> HomeContent(ui, tab, onRefresh, onOpenSection, modifier)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeContent(
    ui: HomeUiState.Content,
    tab: Tab,
    onRefresh: () -> Unit,
    onOpenSection: (Section) -> Unit,
    modifier: Modifier,
) {
    val accent = BactaPalette.accent(Section.Home)
    PullToRefreshBox(isRefreshing = ui.refreshing, onRefresh = onRefresh, modifier = modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            BriefingCard(ui.briefing, onRefresh = onRefresh)
            when (tab) {
                Tab.Overview -> {
                    SectionRail("SYSTEMS", accent, right = "${ui.tiles.count { it.value != null }} ONLINE")
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
                    SectionRail("WEEK IN REVIEW", accent, right = "${ui.trends.count { it.series.isNotEmpty() }} CHANNELS")
                    ui.trends.zip(HomeTrendSections).forEach { (row, section) ->
                        TrendCard(row, BactaPalette.accent(section))
                    }
                }
            }
        }
    }
}
