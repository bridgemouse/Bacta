package io.github.bridgemouse.bacta.ui.metrics

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind

/** Everything a screen needs to present a metric, stated once. `lowerIsBetter == null` means the direction has no good or bad meaning. */
data class MetricSpec(
    val metric: Metric,
    val label: UiText,
    val unit: UiText?,
    val decimals: Int,
    val lowerIsBetter: Boolean?,
    val chart: TrendKind = TrendKind.Line,
    /** Decimals for a change shown next to the value; usually finer than the value itself. */
    val deltaDecimals: Int = decimals,
)

object MetricCatalog {
    private fun label(id: Int) = UiText.of(id)

    private val specs: Map<Metric, MetricSpec> = listOf(
        MetricSpec(Metric.Hrv, label(R.string.label_hrv), label(R.string.unit_ms), 0, lowerIsBetter = false),
        MetricSpec(Metric.RestingHr, label(R.string.metric_resting_hr), label(R.string.unit_bpm), 0, lowerIsBetter = true, deltaDecimals = 1),
        MetricSpec(Metric.StressAvg, label(R.string.metric_stress), label(R.string.unit_avg), 0, lowerIsBetter = true, deltaDecimals = 1),
        MetricSpec(Metric.StressMax, label(R.string.metric_stress), label(R.string.unit_avg), 0, lowerIsBetter = true),
        MetricSpec(Metric.RespAvg, label(R.string.metric_respiration), label(R.string.unit_brpm), 1, lowerIsBetter = true),
        MetricSpec(Metric.Spo2Avg, label(R.string.metric_spo2), label(R.string.unit_percent), 0, lowerIsBetter = false),
        MetricSpec(Metric.RecoveryScore, label(R.string.recovery_score), null, 0, lowerIsBetter = null, chart = TrendKind.Bars),
        MetricSpec(Metric.RecoveryTime, label(R.string.recovery_time_title), label(R.string.unit_hours), 1, lowerIsBetter = true),
        MetricSpec(Metric.BodyBatteryWake, label(R.string.metric_body_battery), null, 0, lowerIsBetter = null, chart = TrendKind.Bars),
        MetricSpec(Metric.SleepHr, label(R.string.metric_sleep_hr), label(R.string.unit_bpm), 1, lowerIsBetter = true),
        MetricSpec(Metric.SleepStress, label(R.string.metric_sleep_stress), label(R.string.unit_avg), 0, lowerIsBetter = true, deltaDecimals = 1),
        MetricSpec(Metric.SleepScore, label(R.string.label_sleep), null, 0, lowerIsBetter = null),
        MetricSpec(Metric.TrainingLoad, label(R.string.label_training_load), null, 0, lowerIsBetter = null, chart = TrendKind.Bars),
        MetricSpec(Metric.BodyBatteryCurrent, label(R.string.metric_body_battery), null, 0, lowerIsBetter = null),
        MetricSpec(Metric.IntensityMod, label(R.string.label_intensity), label(R.string.unit_min), 0, lowerIsBetter = null, chart = TrendKind.Bars),
        MetricSpec(Metric.IntensityVig, label(R.string.label_intensity), label(R.string.unit_min), 0, lowerIsBetter = null, chart = TrendKind.Bars),
    ).associateBy { it.metric }

    fun spec(metric: Metric): MetricSpec = specs.getValue(metric)
}
