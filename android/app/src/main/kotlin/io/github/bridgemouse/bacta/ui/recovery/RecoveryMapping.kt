package io.github.bridgemouse.bacta.ui.recovery

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.domain.Band
import io.github.bridgemouse.bacta.domain.HrvDirection
import io.github.bridgemouse.bacta.domain.HrvTrend
import io.github.bridgemouse.bacta.domain.ReadinessRules
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.components.ChipModel
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import io.github.bridgemouse.bacta.ui.designsystem.components.deltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.formatDelta
import io.github.bridgemouse.bacta.ui.designsystem.components.formatValue

private typealias Trends = Map<Metric, Result<List<Double>>>

val RecoveryMetrics: Set<Metric> = setOf(
    Metric.Hrv, Metric.RestingHr, Metric.BodyBatteryWake, Metric.StressAvg, Metric.RespAvg,
    Metric.RecoveryScore, Metric.SleepStress, Metric.RecoveryTime, Metric.Spo2Avg, Metric.SleepHr,
)

private fun Trends.all(metric: Metric): List<Double> = this[metric]?.getOrNull().orEmpty()
private fun Trends.chart(metric: Metric): List<Double> = all(metric).takeIf { it.size >= 2 }.orEmpty()
private fun fmt(v: Double?, decimals: Int = 0) = v?.let { formatValue(it, decimals) }

fun toRecoveryContent(s: Summary, trends: Trends): RecoveryContent = RecoveryContent(
    readiness = GaugeModel(
        label = "Recovery score",
        value = s.recoveryScore,
        max = 100.0,
        valueText = fmt(s.recoveryScore),
        caption = "/ 100",
        stateText = ReadinessRules.scoreLabel(s.recoveryScore)?.uppercase(),
    ),
    hrv = hrvHeadline(s, trends.all(Metric.Hrv)),
    battery = batteryGauge(s),
    recoveryTime = recoveryMeter(s.recoveryTimeHours),
    pair = listOf(restingHrCard(s, trends), stressCard(s, trends)),
    vitals = vitals(s, trends),
    trends = trendSections(s, trends),
)

private fun hrvHeadline(s: Summary, series: List<Double>): HeadlineModel {
    val hrv = s.hrv
    val avg = s.hrvWeekAvg
    val low = s.hrvBaselineLow
    val high = s.hrvBaselineHigh
    val delta = if (hrv != null && avg != null) (hrv - avg).let { d ->
        formatDelta(d, 0)?.let { DeltaModel("$it ms", deltaDirection(d, lowerIsBetter = false)) }
    } else null
    val chips = buildList {
        if (hrv != null && low != null && high != null) {
            add(if (hrv in low..high) ChipModel("IN RANGE", Tone.Positive) else ChipModel("OUT OF RANGE", Tone.Caution))
        }
        when (HrvTrend.direction(series)) {
            HrvDirection.Rising -> add(ChipModel("↑ IMPROVING", Tone.Positive))
            HrvDirection.Flat -> add(ChipModel("→ STABLE", Tone.Caution))
            HrvDirection.Falling -> add(ChipModel("↓ DECLINING", Tone.Flag))
            null -> Unit
        }
    }
    val footnote = listOfNotNull(
        if (low != null && high != null) "baseline ${formatValue(low, 0)}–${formatValue(high, 0)} ms" else null,
        avg?.let { "7d avg ${formatValue(it, 0)} ms" },
    ).joinToString(" · ").ifEmpty { null }
    return HeadlineModel(
        label = "HRV · last night",
        value = fmt(hrv),
        unit = "ms",
        delta = delta,
        sub = avg?.let { "vs ${formatValue(it, 0)} ms week avg" },
        chips = chips,
        series = series,
        average = avg,
        band = if (low != null && high != null) low..high else null,
        footnote = footnote,
    )
}

private fun batteryGauge(s: Summary): GaugeModel? {
    val now = s.bodyBatteryCurrent
    val wake = s.bodyBatteryWake
    if (now == null && wake == null) return null
    val band = ReadinessRules.batteryBand(now)
    val used = if (now != null && wake != null && wake > now) "-${formatValue(wake - now, 0)} used" else null
    return GaugeModel(
        label = "Body battery · today",
        value = now,
        max = 100.0,
        valueText = fmt(now),
        caption = wake?.let { "WAKE ${formatValue(it, 0)}%" },
        stateText = band?.label,
        tone = band?.tone,
        rightLabel = used,
    )
}

private fun recoveryMeter(hours: Double?): MeterModel? {
    if (hours == null) return null
    val band = ReadinessRules.recoveryTimeBand(hours)
    return MeterModel(
        label = "Recovery time",
        value = formatValue(hours, 1),
        unit = "h",
        stateText = band?.label,
        tone = band?.tone,
        position = ReadinessRules.recoveryTimePosition(hours),
        startLabel = "0h",
        endLabel = "72h",
        zoneLabel = "ready zone 0–24h",
    )
}

private fun mean(series: List<Double>): Double? = series.takeIf { it.isNotEmpty() }?.average()

/** Difference from the average of the drawn series, as text such as "▲ 0.5". */
private fun deltaVsAverage(value: Double?, series: List<Double>, decimals: Int, lowerIsBetter: Boolean): DeltaModel? {
    val avg = mean(series) ?: return null
    if (value == null) return null
    val d = value - avg
    return formatDelta(d, decimals)?.let { DeltaModel(it, deltaDirection(d, lowerIsBetter)) }
}

private fun restingHrCard(s: Summary, trends: Trends): MetricCardModel {
    val delta = deltaVsAverage(s.restingHr, trends.all(Metric.RestingHr), 1, lowerIsBetter = true)
    return MetricCardModel(
        label = "Resting HR",
        value = fmt(s.restingHr),
        unit = "bpm",
        sub = delta?.let { "${it.text} bpm" },
        trend = trends.chart(Metric.RestingHr).ifEmpty { null },
    )
}

private fun stressCard(s: Summary, trends: Trends): MetricCardModel {
    val delta = deltaVsAverage(s.stressAvg, trends.all(Metric.StressAvg), 1, lowerIsBetter = true)
    val sub = listOfNotNull(delta?.text, ReadinessRules.stressLabel(s.stressAvg)).joinToString(" · ").ifEmpty { null }
    return MetricCardModel(
        label = "Stress",
        value = fmt(s.stressAvg),
        unit = "avg",
        sub = sub,
        trend = trends.chart(Metric.StressAvg).ifEmpty { null },
    )
}

private fun tile(label: String, value: String?, unit: String, band: Band?, series: List<Double>) =
    StatusTileModel(label, value, unit, band?.label, band?.tone, series)

private fun vitals(s: Summary, trends: Trends): List<StatusTileModel> = buildList {
    if (s.sleepStress != null) {
        add(tile("Sleep stress", fmt(s.sleepStress), "avg", ReadinessRules.sleepStressBand(s.sleepStress), trends.chart(Metric.SleepStress)))
    }
    add(tile("Respiration", fmt(s.respAvg, 1), "br/m", ReadinessRules.respirationBand(s.respAvg), trends.chart(Metric.RespAvg)))
    if (s.spo2Avg != null) {
        add(tile("SpO₂", fmt(s.spo2Avg), "%", ReadinessRules.spo2Band(s.spo2Avg), trends.chart(Metric.Spo2Avg)))
    }
    if (s.sleepHr != null) {
        add(tile("Sleep HR", fmt(s.sleepHr, 1), "bpm", null, trends.chart(Metric.SleepHr)))
    }
}

private class TrendSpec(
    val rail: String,
    val label: String,
    val metric: Metric,
    val value: (Summary) -> String?,
    val unit: String? = null,
    val kind: TrendKind = TrendKind.Line,
    val decimals: Int = 0,
    val lowerIsBetter: Boolean? = null,
    val caption: String,
)

private val TrendSpecs = listOf(
    TrendSpec("RECOVERY SCORE", "Recovery score", Metric.RecoveryScore, { fmt(it.recoveryScore) }, kind = TrendKind.Bars,
        caption = "80+ optimal · 67–79 ready · below 67 low"),
    TrendSpec("HRV", "HRV", Metric.Hrv, { fmt(it.hrv) }, unit = "ms",
        caption = "higher vs your baseline = better recovered · trend direction shows adaptation"),
    TrendSpec("BODY BATTERY", "Body battery", Metric.BodyBatteryWake, { fmt(it.bodyBatteryWake) }, kind = TrendKind.Bars,
        caption = "wake-up value: how fully recharged sleep restored your energy reserve"),
    TrendSpec("RESTING HR", "Resting HR", Metric.RestingHr, { fmt(it.restingHr) }, unit = "bpm", decimals = 1, lowerIsBetter = true,
        caption = "lower = better · measured during deepest sleep · downward trend = improving fitness"),
    TrendSpec("OVERNIGHT STRESS", "Stress", Metric.StressAvg, { fmt(it.stressAvg) }, unit = "avg", decimals = 1, lowerIsBetter = true,
        caption = "below 26 = rest zone · consistently low = strongest recovery signal"),
    TrendSpec("SLEEP STRESS", "Sleep stress", Metric.SleepStress, { fmt(it.sleepStress) }, unit = "avg", decimals = 1, lowerIsBetter = true,
        caption = "HRV-derived during sleep only · below 26 = rest zone · best overnight recovery signal"),
    TrendSpec("RECOVERY TIME", "Recovery time", Metric.RecoveryTime, { fmt(it.recoveryTimeHours, 1) }, unit = "h", decimals = 1, lowerIsBetter = true,
        caption = "hours until fully recovered · 0 = ready now · drops as you rest"),
    TrendSpec("RESPIRATION", "Respiration", Metric.RespAvg, { fmt(it.respAvg, 1) }, unit = "br/m", decimals = 1, lowerIsBetter = true,
        caption = "12–20 br/m normal · a rise of 1–2 above baseline often signals illness early"),
)

private fun trendSections(s: Summary, trends: Trends): List<TrendSectionModel> = TrendSpecs.mapNotNull { spec ->
    val series = trends.all(spec.metric)
    if (series.isEmpty()) return@mapNotNull null
    val isHrv = spec.metric == Metric.Hrv
    val average = if (isHrv) s.hrvWeekAvg ?: mean(series) else mean(series)
    val delta = when {
        isHrv -> s.hrv?.let { v -> average?.let { a -> formatDelta(v - a, 0)?.let { DeltaModel(it, deltaDirection(v - a, false)) } } }
        spec.lowerIsBetter != null -> deltaVsAverage(spec.value(s)?.toDoubleOrNull(), series, spec.decimals, spec.lowerIsBetter)
        else -> null
    }
    TrendSectionModel(
        spec.rail,
        TrendCardModel(
            label = spec.label,
            value = spec.value(s),
            unit = spec.unit,
            series = series,
            kind = spec.kind,
            delta = delta,
            average = average,
            caption = spec.caption,
        ),
    )
}
