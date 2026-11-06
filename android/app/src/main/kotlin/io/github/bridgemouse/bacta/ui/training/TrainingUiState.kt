package io.github.bridgemouse.bacta.ui.training

import androidx.compose.runtime.Immutable
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingModel
import io.github.bridgemouse.bacta.ui.designsystem.components.ChipModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendSectionModel

/** Garmin's classification of the recent load trajectory and the date it was measured. */
@Immutable
data class StatusModel(val value: UiText, val sub: UiText?)

@Immutable
data class PerformanceModel(val load: HeadlineModel, val fitnessAge: MetricCardModel, val vo2max: MetricCardModel)

/** [zone] is 1 to 5, which the screen maps to a palette token; [percent] is a whole-number share of today's zone time. */
@Immutable
data class ZoneItem(val zone: Int, val label: UiText, val minutes: Int, val percent: Int)

@Immutable
data class ZonesModel(val items: List<ZoneItem>, val totalMinutes: Int)

/** [stats] is always duration, distance, heart rate, calories in that order; a missing value is a dash. */
@Immutable
data class ActivityRowModel(val id: String, val title: UiText, val subtitle: UiText, val stats: List<UiText>)

/** Acute:chronic load on a track; [position], [optimalStart] and [optimalEnd] are 0 to 1 along it. */
@Immutable
data class LoadRatioModel(
    val value: UiText,
    val state: ChipModel?,
    val position: Float,
    val optimalStart: Float,
    val optimalEnd: Float,
    val caption: UiText,
    val zoneLabel: UiText,
)

/** Everything the Training tabs show. Optional cards are null (or empty) when the data behind them does not exist. */
data class TrainingContent(
    val status: StatusModel?,
    val performance: PerformanceModel,
    val loadRatio: LoadRatioModel?,
    val intensity: MeterModel?,
    val zones: ZonesModel?,
    val daily: List<MetricCardModel>,
    val activities: List<ActivityRowModel>,
    val trends: List<TrendSectionModel>,
)

sealed interface TrainingUiState {
    data object Loading : TrainingUiState

    data class Content(
        val briefing: BriefingModel,
        val content: TrainingContent,
        val refreshing: Boolean = false,
    ) : TrainingUiState

    data object Error : TrainingUiState
}
