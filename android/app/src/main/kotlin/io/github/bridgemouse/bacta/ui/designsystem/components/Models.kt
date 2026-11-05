package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.UiText

/** "7 days" as a plural resource; screens override it when the trend window changes. */
val defaultPeriod: UiText = UiText.plural(R.plurals.period_days, 7, 7)

/** What a card shows. Screens map data to these; templates only render them. A null value shows a dash. */

@Immutable
data class DeltaModel(val text: UiText, val direction: DeltaDirection)

@Immutable
data class ChipModel(val text: UiText, val tone: Tone? = null)

@Immutable
data class MetricCardModel(
    val label: UiText,
    val value: UiText?,
    val unit: UiText? = null,
    val sub: UiText? = null,
    val trend: List<Double>? = null,
    val ring: Float? = null,
    val ringText: String? = null,
    val index: String? = null,
    val icon: ImageVector? = null,
)

enum class TrendKind { Line, Bars }

@Immutable
data class TrendCardModel(
    val label: UiText,
    val value: String?,
    val unit: UiText? = null,
    val series: List<Double> = emptyList(),
    val kind: TrendKind = TrendKind.Line,
    val delta: DeltaModel? = null,
    val average: Double? = null,
    val dayLabels: List<String> = emptyList(),
    val caption: UiText? = null,
    val period: UiText = defaultPeriod,
)

@Immutable
data class HeadlineModel(
    val label: UiText,
    val value: String?,
    val unit: UiText? = null,
    val delta: DeltaModel? = null,
    val sub: UiText? = null,
    val chips: List<ChipModel> = emptyList(),
    val series: List<Double> = emptyList(),
    val average: Double? = null,
    val band: ClosedFloatingPointRange<Double>? = null,
    val footnote: UiText? = null,
    val period: UiText = defaultPeriod,
)

@Immutable
data class StatusTileModel(
    val label: UiText,
    val value: String?,
    val unit: UiText? = null,
    val sub: UiText? = null,
    val tone: Tone? = null,
    val series: List<Double> = emptyList(),
    val period: UiText = defaultPeriod,
)

enum class GaugeLayout { Side, Hero }

@Immutable
data class GaugeModel(
    val label: UiText,
    val value: Double?,
    val max: Double,
    val valueText: String?,
    val caption: UiText? = null,
    val stateText: UiText? = null,
    val tone: Tone? = null,
    val description: UiText? = null,
    val rightLabel: UiText? = null,
)

@Immutable
data class MeterModel(
    val label: UiText,
    val value: UiText?,
    val unit: UiText? = null,
    val stateText: UiText? = null,
    val tone: Tone? = null,
    val position: Float? = null,
    val startLabel: UiText? = null,
    val endLabel: UiText? = null,
    val zoneLabel: UiText? = null,
)

@Immutable
data class BriefingContent(
    val tone: Tone,
    val headline: String,
    val summary: String?,
    val directive: String?,
)

sealed interface BriefingState {
    data object Loading : BriefingState
    data class Live(val content: BriefingContent, val timestamp: UiText) : BriefingState
    data class Stale(val content: BriefingContent, val age: UiText) : BriefingState
    data object NoBriefing : BriefingState
    data class Offline(val last: BriefingContent?, val age: UiText?) : BriefingState
    data object Error : BriefingState
}

@Immutable
data class BriefingModel(val title: UiText, val state: BriefingState)

/** The night's resampled stages and the clock labels under the chart; a missing night has no model at all. */
@Immutable
data class HypnogramModel(val levels: List<io.github.bridgemouse.bacta.domain.SleepStage?>, val axisLabels: List<String>)
