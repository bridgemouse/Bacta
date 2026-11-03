package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector
import io.github.bridgemouse.bacta.domain.Tone

/** What a card shows. Screens map data to these; templates only render them. A null value shows a dash. */

@Immutable
data class DeltaModel(val text: String, val direction: DeltaDirection)

@Immutable
data class ChipModel(val text: String, val tone: Tone? = null)

@Immutable
data class MetricCardModel(
    val label: String,
    val value: String?,
    val unit: String? = null,
    val sub: String? = null,
    val trend: List<Double>? = null,
    val ring: Float? = null,
    val ringText: String? = null,
    val index: String? = null,
    val icon: ImageVector? = null,
)

enum class TrendKind { Line, Bars }

@Immutable
data class TrendCardModel(
    val label: String,
    val value: String?,
    val unit: String? = null,
    val series: List<Double> = emptyList(),
    val kind: TrendKind = TrendKind.Line,
    val delta: DeltaModel? = null,
    val average: Double? = null,
    val dayLabels: List<String> = emptyList(),
    val caption: String? = null,
    val period: String = "7 days",
)

@Immutable
data class HeadlineModel(
    val label: String,
    val value: String?,
    val unit: String? = null,
    val delta: DeltaModel? = null,
    val sub: String? = null,
    val chips: List<ChipModel> = emptyList(),
    val series: List<Double> = emptyList(),
    val average: Double? = null,
    val band: ClosedFloatingPointRange<Double>? = null,
    val footnote: String? = null,
    val period: String = "7 days",
)

@Immutable
data class StatusTileModel(
    val label: String,
    val value: String?,
    val unit: String? = null,
    val sub: String? = null,
    val tone: Tone? = null,
    val series: List<Double> = emptyList(),
    val period: String = "7 days",
)

enum class GaugeLayout { Side, Hero }

@Immutable
data class GaugeModel(
    val label: String,
    val value: Double?,
    val max: Double,
    val valueText: String?,
    val caption: String? = null,
    val stateText: String? = null,
    val tone: Tone? = null,
    val description: String? = null,
    val rightLabel: String? = null,
)

@Immutable
data class MeterModel(
    val label: String,
    val value: String?,
    val unit: String? = null,
    val stateText: String? = null,
    val tone: Tone? = null,
    val position: Float? = null,
    val startLabel: String = "",
    val endLabel: String = "",
    val zoneLabel: String? = null,
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
    data class Live(val content: BriefingContent, val timestamp: String) : BriefingState
    data class Stale(val content: BriefingContent, val age: String) : BriefingState
    data object NoBriefing : BriefingState
    data class Offline(val last: BriefingContent?, val age: String?) : BriefingState
    data object Error : BriefingState
}

@Immutable
data class BriefingModel(val title: String, val state: BriefingState)
