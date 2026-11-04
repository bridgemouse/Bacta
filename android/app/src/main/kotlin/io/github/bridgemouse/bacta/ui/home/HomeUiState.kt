package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel

sealed interface HomeUiState {
    data object Loading : HomeUiState

    /** [refreshing] keeps the previous content on screen while a reload is in flight. */
    data class Content(
        val briefing: BriefingModel,
        val tiles: List<MetricCardModel>,
        val trends: List<TrendCardModel>,
        val refreshing: Boolean = false,
    ) : HomeUiState

    data object Error : HomeUiState
}
