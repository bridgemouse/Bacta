package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel

/** A rail heading over one trend card. */
data class TrendSectionModel(val rail: UiText, val card: TrendCardModel)

/** Everything the Recovery tabs show. Optional cards are null when the data behind them does not exist. */
data class RecoveryContent(
    val readiness: GaugeModel,
    val hrv: HeadlineModel,
    val battery: GaugeModel?,
    val recoveryTime: MeterModel?,
    val pair: List<MetricCardModel>,
    val vitals: List<StatusTileModel>,
    val trends: List<TrendSectionModel>,
)

sealed interface RecoveryUiState {
    data object Loading : RecoveryUiState

    data class Content(
        val briefing: BriefingModel,
        val content: RecoveryContent,
        val refreshing: Boolean = false,
    ) : RecoveryUiState {
        val readiness get() = content.readiness
        val trends get() = content.trends
    }

    data object Error : RecoveryUiState
}
