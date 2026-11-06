package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Band
import io.github.bridgemouse.bacta.domain.HrvDirection
import io.github.bridgemouse.bacta.domain.HrvTrend
import io.github.bridgemouse.bacta.domain.ReadinessRules
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.ChipModel
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendSectionModel
import io.github.bridgemouse.bacta.ui.metrics.TrendSpec
import io.github.bridgemouse.bacta.ui.metrics.buildTrendSections
import io.github.bridgemouse.bacta.ui.designsystem.components.delta
import io.github.bridgemouse.bacta.ui.designsystem.components.deltaDirection
import io.github.bridgemouse.bacta.ui.format.Formatters

private typealias Trends = Map<Metric, Result<List<Double>>>

val RecoveryMetrics: Set<Metric> = setOf(
    Metric.Hrv, Metric.RestingHr, Metric.BodyBatteryWake, Metric.StressAvg, Metric.RespAvg,
    Metric.RecoveryScore, Metric.SleepStress, Metric.RecoveryTime, Metric.Spo2Avg, Metric.SleepHr,
)

private fun Trends.all(metric: Metric): List<Double> = this[metric]?.getOrNull().orEmpty()
private fun Trends.chart(metric: Metric): List<Double> = all(metric).takeIf { it.size >= 2 }.orEmpty()
private fun Band.text(): UiText = UiText.Literal(label)

fun toRecoveryContent(s: Summary, trends: Trends, f: Formatters): RecoveryContent = RecoveryContent(
    readiness = GaugeModel(
        label = UiText.of(R.string.recovery_score),
        value = s.recoveryScore,
        max = 100.0,
        valueText = s.recoveryScore?.let { f.number(it, 0) },
        caption = UiText.of(R.string.of_hundred),
        stateText = ReadinessRules.scoreLabel(s.recoveryScore)?.uppercase()?.let { UiText.Literal(it) },
        description = scoreDescription(s.recoveryScore),
    ),
    hrv = hrvHeadline(s, trends.all(Metric.Hrv), f),
    battery = batteryGauge(s, f),
    recoveryTime = recoveryMeter(s.recoveryTimeHours, f),
    pair = listOf(restingHrCard(s, trends, f), stressCard(s, trends, f)),
    vitals = vitals(s, trends, f),
    trends = trendSections(s, trends, f),
)

private fun scoreDescription(score: Double?): UiText? = when (ReadinessRules.scoreLabel(score)) {
    "Optimal" -> UiText.of(R.string.recovery_desc_optimal)
    "Ready" -> UiText.of(R.string.recovery_desc_ready)
    "Low" -> UiText.of(R.string.recovery_desc_low)
    else -> null
}

private fun hrvHeadline(s: Summary, series: List<Double>, f: Formatters): HeadlineModel {
    val hrv = s.hrv
    val avg = s.hrvWeekAvg
    val low = s.hrvBaselineLow
    val high = s.hrvBaselineHigh
    val delta = if (hrv != null && avg != null) (hrv - avg).let { d ->
        f.delta(d, 0)?.let { DeltaModel(UiText.of(R.string.delta_with_unit, it, UiText.of(R.string.unit_ms)), deltaDirection(d, lowerIsBetter = false)) }
    } else null
    val chips = buildList {
        if (hrv != null && low != null && high != null) {
            add(if (hrv in low..high) ChipModel(UiText.of(R.string.chip_in_range), Tone.Positive) else ChipModel(UiText.of(R.string.chip_out_of_range), Tone.Caution))
        }
        when (HrvTrend.direction(series)) {
            HrvDirection.Rising -> add(ChipModel(UiText.of(R.string.chip_improving), Tone.Positive))
            HrvDirection.Flat -> add(ChipModel(UiText.of(R.string.chip_stable), Tone.Caution))
            HrvDirection.Falling -> add(ChipModel(UiText.of(R.string.chip_declining), Tone.Flag))
            null -> Unit
        }
    }
    val baseline = if (low != null && high != null) UiText.of(R.string.hrv_baseline, f.number(low, 0), f.number(high, 0)) else null
    val average = avg?.let { UiText.of(R.string.hrv_avg7, f.number(it, 0)) }
    val footnote = when {
        baseline != null && average != null -> UiText.of(R.string.join_dot, baseline, average)
        else -> baseline ?: average
    }
    return HeadlineModel(
        label = UiText.of(R.string.hrv_title),
        value = hrv?.let { f.number(it, 0) },
        unit = UiText.of(R.string.unit_ms),
        delta = delta,
        sub = avg?.let { UiText.of(R.string.hrv_vs_week, f.number(it, 0)) },
        chips = chips,
        series = series,
        average = avg,
        band = if (low != null && high != null) low..high else null,
        footnote = footnote,
    )
}

private fun batteryGauge(s: Summary, f: Formatters): GaugeModel? {
    val now = s.bodyBatteryCurrent
    val wake = s.bodyBatteryWake
    if (now == null && wake == null) return null
    val band = ReadinessRules.batteryBand(now)
    val used = if (now != null && wake != null && wake > now) UiText.of(R.string.battery_used, f.number(wake - now, 0)) else null
    return GaugeModel(
        label = UiText.of(R.string.battery_title),
        value = now,
        max = 100.0,
        valueText = now?.let { f.number(it, 0) },
        caption = wake?.let { UiText.of(R.string.battery_wake, f.number(it, 0)) },
        stateText = band?.text(),
        tone = band?.tone,
        rightLabel = used,
    )
}

private fun recoveryMeter(hours: Double?, f: Formatters): MeterModel? {
    if (hours == null) return null
    val band = ReadinessRules.recoveryTimeBand(hours)
    return MeterModel(
        label = UiText.of(R.string.recovery_time_title),
        value = UiText.Literal(f.number(hours, 1)),
        unit = UiText.of(R.string.unit_hours),
        stateText = band?.text(),
        tone = band?.tone,
        position = ReadinessRules.recoveryTimePosition(hours),
        startLabel = UiText.of(R.string.meter_zero_h),
        endLabel = UiText.of(R.string.meter_max_72h),
        zoneLabel = UiText.of(R.string.recovery_ready_zone),
    )
}

private fun mean(series: List<Double>): Double? = series.takeIf { it.isNotEmpty() }?.average()

/** Difference from the average of the drawn series, as text such as "▲ 0.5". */
private fun deltaVsAverage(value: Double?, series: List<Double>, decimals: Int, lowerIsBetter: Boolean, f: Formatters): DeltaModel? {
    val avg = mean(series) ?: return null
    if (value == null) return null
    val d = value - avg
    return f.delta(d, decimals)?.let { DeltaModel(it, deltaDirection(d, lowerIsBetter)) }
}

private fun restingHrCard(s: Summary, trends: Trends, f: Formatters): MetricCardModel {
    val delta = deltaVsAverage(s.restingHr, trends.all(Metric.RestingHr), 1, lowerIsBetter = true, f = f)
    return MetricCardModel(
        label = UiText.of(R.string.metric_resting_hr),
        value = s.restingHr?.let { UiText.Literal(f.number(it, 0)) },
        unit = UiText.of(R.string.unit_bpm),
        sub = delta?.let { UiText.of(R.string.delta_with_unit, it.text, UiText.of(R.string.unit_bpm)) },
        trend = trends.chart(Metric.RestingHr).ifEmpty { null },
    )
}

private fun stressCard(s: Summary, trends: Trends, f: Formatters): MetricCardModel {
    val delta = deltaVsAverage(s.stressAvg, trends.all(Metric.StressAvg), 1, lowerIsBetter = true, f = f)
    val label = ReadinessRules.stressLabel(s.stressAvg)?.let { UiText.Literal(it) }
    val sub = when {
        delta != null && label != null -> UiText.of(R.string.join_dot, delta.text, label)
        else -> delta?.text ?: label
    }
    return MetricCardModel(
        label = UiText.of(R.string.metric_stress),
        value = s.stressAvg?.let { UiText.Literal(f.number(it, 0)) },
        unit = UiText.of(R.string.unit_avg),
        sub = sub,
        trend = trends.chart(Metric.StressAvg).ifEmpty { null },
    )
}

private fun tile(label: UiText, value: String?, unit: UiText, band: Band?, series: List<Double>) =
    StatusTileModel(label, value, unit, band?.text(), band?.tone, series)

private fun vitals(s: Summary, trends: Trends, f: Formatters): List<StatusTileModel> = buildList {
    if (s.sleepStress != null) {
        add(tile(UiText.of(R.string.metric_sleep_stress), f.number(s.sleepStress, 0), UiText.of(R.string.unit_avg), ReadinessRules.sleepStressBand(s.sleepStress), trends.chart(Metric.SleepStress)))
    }
    add(tile(UiText.of(R.string.metric_respiration), s.respAvg?.let { f.number(it, 1) }, UiText.of(R.string.unit_brpm), ReadinessRules.respirationBand(s.respAvg), trends.chart(Metric.RespAvg)))
    if (s.spo2Avg != null) {
        add(tile(UiText.of(R.string.metric_spo2), f.number(s.spo2Avg, 0), UiText.of(R.string.unit_percent), ReadinessRules.spo2Band(s.spo2Avg), trends.chart(Metric.Spo2Avg)))
    }
    if (s.sleepHr != null) {
        add(tile(UiText.of(R.string.metric_sleep_hr), f.number(s.sleepHr, 1), UiText.of(R.string.unit_bpm), null, trends.chart(Metric.SleepHr)))
    }
}

private val TrendSpecs = listOf(
    TrendSpec(UiText.of(R.string.rail_recovery_score), Metric.RecoveryScore, UiText.of(R.string.cap_recovery_score)),
    TrendSpec(UiText.of(R.string.rail_hrv), Metric.Hrv, UiText.of(R.string.cap_hrv)),
    TrendSpec(UiText.of(R.string.rail_body_battery), Metric.BodyBatteryWake, UiText.of(R.string.cap_body_battery)),
    TrendSpec(UiText.of(R.string.rail_resting_hr), Metric.RestingHr, UiText.of(R.string.cap_resting_hr)),
    TrendSpec(UiText.of(R.string.rail_overnight_stress), Metric.StressAvg, UiText.of(R.string.cap_overnight_stress)),
    TrendSpec(UiText.of(R.string.rail_sleep_stress), Metric.SleepStress, UiText.of(R.string.cap_sleep_stress)),
    TrendSpec(UiText.of(R.string.rail_recovery_time), Metric.RecoveryTime, UiText.of(R.string.cap_recovery_time)),
    TrendSpec(UiText.of(R.string.rail_respiration), Metric.RespAvg, UiText.of(R.string.cap_respiration)),
)

private fun trendSections(s: Summary, trends: Trends, f: Formatters): List<TrendSectionModel> =
    buildTrendSections(TrendSpecs, s, { trends.all(it) }, f)
