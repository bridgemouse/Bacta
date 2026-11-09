package io.github.bridgemouse.bacta.ui.home

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.TrainingStatus
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.SectionIcons
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import io.github.bridgemouse.bacta.ui.designsystem.components.delta
import io.github.bridgemouse.bacta.ui.designsystem.components.deltaDirection
import io.github.bridgemouse.bacta.ui.format.Formatters
import io.github.bridgemouse.bacta.ui.metrics.MetricCatalog

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

fun toTiles(summary: Summary, trends: Trends, fmt: Formatters): List<MetricCardModel> = listOf(
    MetricCardModel(
        label = UiText.of(R.string.label_recovery),
        icon = SectionIcons.of(Section.Recovery),
        value = summary.bodyBatteryCurrent?.let { UiText.Literal(fmt.number(it, 0)) },
        unit = UiText.of(R.string.unit_battery),
        sub = hrvSub(summary.hrv, summary.hrvWeekAvg, fmt),
        trend = trends.series(Metric.BodyBatteryCurrent),
        index = "01",
    ),
    MetricCardModel(
        label = UiText.of(R.string.label_training),
        icon = SectionIcons.of(Section.Training),
        value = summary.trainingLoad?.let { UiText.Literal(fmt.number(it, 0)) },
        unit = UiText.of(R.string.unit_load),
        sub = TrainingStatus.label(summary.trainingStatusN)?.let { UiText.Literal(it) },
        trend = trends.series(Metric.TrainingLoad),
        index = "02",
    ),
    MetricCardModel(
        label = UiText.of(R.string.label_sleep),
        icon = SectionIcons.of(Section.Sleep),
        value = summary.sleepSeconds?.let(fmt::duration),
        sub = summary.sleepScore?.let { UiText.of(R.string.sleep_score_sub, fmt.number(it, 0)) },
        ring = summary.sleepScore?.let { (it / 100).toFloat() },
        index = "03",
    ),
)

private fun hrvSub(hrv: Double?, weekAvg: Double?, fmt: Formatters): UiText? = when {
    hrv == null -> null
    weekAvg == null -> UiText.of(R.string.hrv_sub_plain, fmt.number(hrv, 0))
    hrv > weekAvg -> UiText.of(R.string.hrv_sub_up, fmt.number(hrv, 0))
    else -> UiText.of(R.string.hrv_sub_down, fmt.number(hrv, 0))
}

/** Change from the previous day within the series actually drawn. Training measures are neutral: more load is not "good". */
private fun dayDelta(series: List<Double>, fmt: Formatters, neutral: Boolean = false): DeltaModel? {
    if (series.size < 2) return null
    val delta = series.last() - series[series.size - 2]
    val text = fmt.delta(delta, 0) ?: return null
    return DeltaModel(text, if (neutral) DeltaDirection.Flat else deltaDirection(delta, lowerIsBetter = false))
}

fun toTrendRows(summary: Summary, trends: Trends, fmt: Formatters): List<TrendCardModel> {
    fun series(metric: Metric) = trends[metric]?.getOrNull().orEmpty()

    val hrvDelta = if (summary.hrv != null && summary.hrvWeekAvg != null) {
        val d = summary.hrv - summary.hrvWeekAvg
        fmt.delta(d, 0)?.let { DeltaModel(it, deltaDirection(d, lowerIsBetter = false)) }
    } else null

    val intensity = combinedIntensity(series(Metric.IntensityMod), series(Metric.IntensityVig))

    return listOf(
        TrendCardModel(UiText.of(R.string.label_recovery), summary.recoveryScore?.let { fmt.number(it, 0) }, series = series(Metric.RecoveryScore), delta = dayDelta(series(Metric.RecoveryScore), fmt), average = mean(series(Metric.RecoveryScore))),
        TrendCardModel(UiText.of(R.string.label_hrv), summary.hrv?.let { fmt.number(it, 0) }, unit = MetricCatalog.spec(Metric.Hrv).unit, series = series(Metric.Hrv), delta = hrvDelta, average = summary.hrvWeekAvg ?: mean(series(Metric.Hrv))),
        TrendCardModel(UiText.of(R.string.label_sleep), summary.sleepScore?.let { fmt.number(it, 0) }, series = series(Metric.SleepScore), delta = dayDelta(series(Metric.SleepScore), fmt), average = mean(series(Metric.SleepScore))),
        TrendCardModel(UiText.of(R.string.label_training_load), summary.trainingLoad?.let { fmt.number(it, 0) }, series = series(Metric.TrainingLoad), kind = TrendKind.Bars, delta = dayDelta(series(Metric.TrainingLoad), fmt, neutral = true), average = mean(series(Metric.TrainingLoad))),
        TrendCardModel(UiText.of(R.string.label_intensity), intensity.lastOrNull()?.let { fmt.number(it, 0) }, unit = MetricCatalog.spec(Metric.IntensityMod).unit, series = intensity, kind = TrendKind.Bars, average = mean(intensity)),
    )
}

/** The reference line for a chart: needs at least two points to mean anything. */
private fun mean(series: List<Double>): Double? = series.takeIf { it.size >= 2 }?.average()

/** Garmin counts vigorous minutes double. The two series are only combined when they have the same length, since dates are not carried. */
private fun combinedIntensity(moderate: List<Double>, vigorous: List<Double>): List<Double> =
    if (moderate.isNotEmpty() && moderate.size == vigorous.size) moderate.zip(vigorous) { m, v -> m + 2 * v } else emptyList()
