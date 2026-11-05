package io.github.bridgemouse.bacta.ui.sleep

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HypnogramModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.StageItem
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendSectionModel
import java.time.LocalDate

/** Which night the numbers belong to; [stale] when it is older than yesterday, so an unrecorded night is never passed off as last night. */
data class NightLabel(val date: LocalDate, val stale: Boolean)

data class ArchitecturePart(val label: UiText, val fraction: Float)

data class ArchitectureModel(val gauge: GaugeModel, val parts: List<ArchitecturePart>)

/** Everything the Sleep tabs show. Optional cards are null when the data behind them does not exist. */
data class SleepContent(
    val night: NightLabel?,
    val asleep: UiText?,
    val inBed: UiText?,
    val score: GaugeModel,
    val stages: List<StageItem>,
    val efficiency: MetricCardModel,
    val debt: MeterModel?,
    val hypnogram: HypnogramModel?,
    val architecture: ArchitectureModel?,
    val vitals: List<StatusTileModel>,
    val trends: List<TrendSectionModel>,
)

sealed interface SleepUiState {
    data object Loading : SleepUiState

    data class Content(
        val briefing: BriefingModel,
        val content: SleepContent,
        val refreshing: Boolean = false,
    ) : SleepUiState

    data object Error : SleepUiState
}
