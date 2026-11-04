package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.TrainingStatus
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import io.github.bridgemouse.bacta.ui.designsystem.components.deltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.formatDelta
import io.github.bridgemouse.bacta.ui.designsystem.components.formatValue
import kotlin.math.roundToInt

private typealias Trends = Map<Metric, Result<List<Double>>>

val HomeMetrics: Set<Metric> = setOf(
    Metric.BodyBatteryCurrent, Metric.TrainingLoad, Metric.RecoveryScore, Metric.Hrv,
    Metric.SleepScore, Metric.IntensityMod, Metric.IntensityVig,
)

/** The section each tile / trend row belongs to, in the same order as [toTiles] / [toTrendRows]. */
val HomeTileSections: List<Section> = listOf(Section.Recovery, Section.Training, Section.Sleep)
val HomeTrendSections: List<Section> =
    listOf(Section.Recovery, Section.Recovery, Section.Sleep, Section.Training, Section.Training)

/** A sparkline needs at least two real points; anything less is shown as no chart, never invented. */
private fun Trends.series(metric: Metric): List<Double>? = this[metric]?.getOrNull()?.takeIf { it.size >= 2 }

fun toTiles(summary: Summary, trends: Trends): List<MetricCardModel> = listOf(
    MetricCardModel(
        label = "Recovery",
        value = summary.bodyBatteryCurrent?.let { formatValue(it, 0) },
        unit = "battery",
        sub = hrvSub(summary.hrv, summary.hrvWeekAvg),
        trend = trends.series(Metric.BodyBatteryCurrent),
        index = "01",
    ),
    MetricCardModel(
        label = "Training",
        value = summary.trainingLoad?.let { formatValue(it, 0) },
        unit = "load",
        sub = TrainingStatus.label(summary.trainingStatusN),
        trend = trends.series(Metric.TrainingLoad),
        index = "02",
    ),
    MetricCardModel(
        label = "Sleep",
        value = formatDuration(summary.sleepSeconds),
        sub = summary.sleepScore?.let { "Score ${formatValue(it, 0)}" },
        ring = summary.sleepScore?.let { (it / 100).toFloat() },
        index = "03",
    ),
)

private fun hrvSub(hrv: Double?, weekAvg: Double?): String? = when {
    hrv == null -> null
    weekAvg == null -> "HRV ${formatValue(hrv, 0)} ms"
    else -> "HRV ${if (hrv > weekAvg) "↑" else "↓"} ${formatValue(hrv, 0)} ms"
}

fun formatDuration(seconds: Double?): String? {
    if (seconds == null || seconds <= 0) return null
    val minutes = (seconds / 60).roundToInt()
    val h = minutes / 60
    val m = minutes % 60
    return when {
        h == 0 -> "${m}m"
        m == 0 -> "${h}h"
        else -> "${h}h ${m}m"
    }
}

/** Change from the previous day within the series actually drawn. Training measures are neutral: more load is not "good". */
private fun dayDelta(series: List<Double>, neutral: Boolean = false): DeltaModel? {
    if (series.size < 2) return null
    val delta = series.last() - series[series.size - 2]
    val text = formatDelta(delta, 0) ?: return null
    return DeltaModel(text, if (neutral) DeltaDirection.Flat else deltaDirection(delta, lowerIsBetter = false))
}

fun toTrendRows(summary: Summary, trends: Trends): List<TrendCardModel> {
    fun series(metric: Metric) = trends[metric]?.getOrNull().orEmpty()

    val hrvDelta = if (summary.hrv != null && summary.hrvWeekAvg != null) {
        val d = summary.hrv - summary.hrvWeekAvg
        formatDelta(d, 0)?.let { DeltaModel(it, deltaDirection(d, lowerIsBetter = false)) }
    } else null

    val intensity = combinedIntensity(series(Metric.IntensityMod), series(Metric.IntensityVig))

    return listOf(
        TrendCardModel("Recovery", summary.recoveryScore?.let { formatValue(it, 0) }, series = series(Metric.RecoveryScore), delta = dayDelta(series(Metric.RecoveryScore))),
        TrendCardModel("HRV", summary.hrv?.let { formatValue(it, 0) }, unit = "ms", series = series(Metric.Hrv), delta = hrvDelta, average = summary.hrvWeekAvg),
        TrendCardModel("Sleep", summary.sleepScore?.let { formatValue(it, 0) }, series = series(Metric.SleepScore), delta = dayDelta(series(Metric.SleepScore))),
        TrendCardModel("Training Load", summary.trainingLoad?.let { formatValue(it, 0) }, series = series(Metric.TrainingLoad), kind = TrendKind.Bars, delta = dayDelta(series(Metric.TrainingLoad), neutral = true)),
        TrendCardModel("Intensity", intensity.lastOrNull()?.let { formatValue(it, 0) }, unit = "min", series = intensity, kind = TrendKind.Bars),
    )
}

/** Garmin counts vigorous minutes double. The two series are only combined when they have the same length, since dates are not carried. */
private fun combinedIntensity(moderate: List<Double>, vigorous: List<Double>): List<Double> =
    if (moderate.isNotEmpty() && moderate.size == vigorous.size) moderate.zip(vigorous) { m, v -> m + 2 * v } else emptyList()
