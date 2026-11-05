package io.github.bridgemouse.bacta.ui.metrics

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.referenceAverage
import io.github.bridgemouse.bacta.data.repository.valueOf
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendSectionModel
import io.github.bridgemouse.bacta.ui.designsystem.components.delta
import io.github.bridgemouse.bacta.ui.designsystem.components.deltaDirection
import io.github.bridgemouse.bacta.ui.format.Formatters

/** One chart section of a screen: its rail label, the metric (label, unit, decimals and direction come from [MetricCatalog]) and the explanation under it. */
data class TrendSpec(val rail: UiText, val metric: Metric, val caption: UiText)

/** "7 days" as a plural resource, so the window can change without any text changing in code. */
fun periodOf(days: Int): UiText = UiText.plural(R.plurals.period_days, days, days)

/** Sections for every spec that has a drawn series; a section with no data is omitted, never faked. */
fun buildTrendSections(
    specs: List<TrendSpec>,
    summary: Summary,
    series: (Metric) -> List<Double>,
    fmt: Formatters,
    days: Int = 7,
    labels: (Metric) -> List<String> = { emptyList() },
): List<TrendSectionModel> = specs.mapNotNull { spec ->
    val points = series(spec.metric)
    if (points.isEmpty()) return@mapNotNull null
    val catalog = MetricCatalog.spec(spec.metric)
    val value = summary.valueOf(spec.metric)
    val average = summary.referenceAverage(spec.metric) ?: points.average()
    val delta = if (catalog.lowerIsBetter != null && value != null) {
        val d = value - average
        fmt.delta(d, catalog.deltaDecimals)?.let { DeltaModel(it, deltaDirection(d, catalog.lowerIsBetter)) }
    } else null
    TrendSectionModel(
        spec.rail,
        TrendCardModel(
            label = catalog.label,
            value = value?.let { fmt.number(it, catalog.decimals) },
            unit = catalog.unit,
            series = points,
            dayLabels = labels(spec.metric).takeIf { it.size == points.size }.orEmpty(),
            kind = catalog.chart,
            delta = delta,
            average = average,
            caption = spec.caption,
            period = periodOf(days),
        ),
    )
}
