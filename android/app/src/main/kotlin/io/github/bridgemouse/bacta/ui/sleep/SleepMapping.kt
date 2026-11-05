package io.github.bridgemouse.bacta.ui.sleep

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.NightHypnogram
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.domain.Band
import io.github.bridgemouse.bacta.domain.Hypnogram
import io.github.bridgemouse.bacta.domain.SleepRules
import io.github.bridgemouse.bacta.domain.SleepStage
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.GaugeModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HypnogramModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MeterModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.StatusTileModel
import io.github.bridgemouse.bacta.ui.format.Formatters
import io.github.bridgemouse.bacta.ui.metrics.TrendSpec
import io.github.bridgemouse.bacta.ui.metrics.buildTrendSections
import java.time.LocalDate
import kotlin.math.roundToInt

private typealias Points = Map<Metric, Result<List<TrendPoint>>>

val SleepMetrics: Set<Metric> = setOf(Metric.SleepScore, Metric.SleepSeconds, Metric.SleepHr, Metric.SleepResp, Metric.SleepStress)

private val SleepTrendSpecs = listOf(
    TrendSpec(UiText.of(R.string.rail_duration), Metric.SleepSeconds, UiText.of(R.string.cap_sleep_duration)),
    TrendSpec(UiText.of(R.string.rail_sleep_score), Metric.SleepScore, UiText.of(R.string.cap_sleep_score)),
    TrendSpec(UiText.of(R.string.rail_sleep_hr), Metric.SleepHr, UiText.of(R.string.cap_sleep_hr)),
    TrendSpec(UiText.of(R.string.rail_respiration), Metric.SleepResp, UiText.of(R.string.cap_sleep_resp)),
    TrendSpec(UiText.of(R.string.rail_sleep_stress), Metric.SleepStress, UiText.of(R.string.cap_sleep_screen_stress)),
)

private fun Double.minutes(): Int = (this / 60).roundToInt()
private fun Band.text(): UiText = UiText.Literal(label)

fun toSleepContent(
    summary: Summary,
    points: Points,
    hypnogram: NightHypnogram?,
    targets: Targets,
    fmt: Formatters,
    today: LocalDate,
): SleepContent {
    fun series(metric: Metric): List<TrendPoint> = points[metric]?.getOrNull().orEmpty()
    fun chart(metric: Metric): List<Double> = series(metric).map { it.value }.takeIf { it.size >= 2 }.orEmpty()

    val asleepSec = summary.sleepSeconds
    val awakeSec = summary.sleepAwakeSeconds
    val asleepMin = asleepSec?.minutes()
    val awakeMin = awakeSec?.minutes()

    return SleepContent(
        night = nightLabel(points, today),
        asleep = asleepSec?.let(fmt::duration),
        inBed = if (asleepSec != null && awakeSec != null) fmt.duration(asleepSec + awakeSec)?.let { UiText.of(R.string.in_bed, it) } else null,
        score = scoreGauge(summary.sleepScore, fmt),
        stages = stageItems(summary, fmt),
        efficiency = efficiencyCard(asleepMin, awakeMin, fmt),
        debt = debtMeter(series(Metric.SleepSeconds).map { it.value.roundToInt() }, asleepMin, targets, fmt),
        hypnogram = hypnogram?.let { HypnogramModel(it.levels, Hypnogram.axisLabels(it.startLocalMs, it.endLocalMs, fmt)) },
        architecture = architecture(summary, asleepMin, awakeMin, fmt),
        vitals = vitals(summary, ::chart, fmt),
        trends = buildTrendSections(
            SleepTrendSpecs, summary, { series(it).map { p -> p.value } }, fmt, targets.trendDays,
            labels = { metric -> series(metric).map { fmt.weekdayInitial(it.date) } },
        ),
    )
}

/** The date the latest sleep reading belongs to. Garmin stores a night under the morning it ended, so "last night" is today's date. */
private fun nightLabel(points: Points, today: LocalDate): NightLabel? {
    val latest = (points[Metric.SleepScore]?.getOrNull().orEmpty() + points[Metric.SleepSeconds]?.getOrNull().orEmpty()).maxOfOrNull { it.date }
    return latest?.let { NightLabel(it, stale = it.isBefore(today.minusDays(1))) }
}

private fun scoreGauge(score: Double?, fmt: Formatters): GaugeModel {
    val band = SleepRules.scoreBand(score)
    return GaugeModel(
        label = UiText.of(R.string.sleep_score),
        value = score,
        max = 100.0,
        valueText = score?.let { fmt.number(it, 0) },
        caption = UiText.of(R.string.of_hundred),
        stateText = band?.label?.uppercase()?.let { UiText.Literal(it) },
        tone = band?.tone,
    )
}

private fun stageItems(s: Summary, fmt: Formatters): List<StageItem> {
    val deep = s.sleepDeepSeconds ?: return emptyList()
    val light = s.sleepLightSeconds ?: return emptyList()
    val rem = s.sleepRemSeconds ?: return emptyList()
    val minutes = listOf(deep.minutes(), light.minutes(), rem.minutes())
    val percents = SleepRules.stagePercents(minutes[0], minutes[1], minutes[2])
    fun text(min: Int) = fmt.duration(min * 60.0) ?: UiText.of(R.string.duration_m, 0)
    return buildList {
        add(StageItem(SleepStage.Deep, UiText.of(R.string.stage_deep), text(minutes[0]), percents[0]))
        add(StageItem(SleepStage.Light, UiText.of(R.string.stage_light), text(minutes[1]), percents[1]))
        add(StageItem(SleepStage.Rem, UiText.of(R.string.stage_rem), text(minutes[2]), percents[2]))
        s.sleepAwakeSeconds?.let { add(StageItem(SleepStage.Awake, UiText.of(R.string.stage_awake), text(it.minutes()), 0)) }
    }
}

private fun efficiencyCard(asleepMin: Int?, awakeMin: Int?, fmt: Formatters): MetricCardModel {
    val percent = if (asleepMin != null && awakeMin != null) SleepRules.efficiencyPercent(asleepMin, awakeMin) else null
    return MetricCardModel(
        label = UiText.of(R.string.metric_efficiency),
        value = percent?.let { UiText.Literal(fmt.number(it.toDouble(), 0)) },
        unit = UiText.of(R.string.unit_percent),
    )
}

/** Debt over the last week of recorded nights against the user's own target; the bar shows how much of that week's target was met. */
private fun debtMeter(nightMinutes: List<Int>, latestNight: Int?, targets: Targets, fmt: Formatters): MeterModel? {
    val nights = nightMinutes.takeLast(7).ifEmpty { listOfNotNull(latestNight?.takeIf { it > 0 }) }
    if (nights.isEmpty()) return null
    val debt = SleepRules.debtMinutes(nights, targets.sleepMinutes)
    val restored = (1.0 - debt.toDouble() / (nights.size * targets.sleepMinutes)).coerceIn(0.0, 1.0).toFloat()
    return MeterModel(
        label = UiText.of(R.string.metric_sleep_debt),
        value = fmt.duration(debt * 60.0) ?: UiText.of(R.string.duration_m, 0),
        stateText = UiText.of(if (debt == 0) R.string.debt_restored else R.string.debt_accumulating),
        tone = if (debt == 0) Tone.Positive else null,
        position = restored,
    )
}

private fun architecture(s: Summary, asleepMin: Int?, awakeMin: Int?, fmt: Formatters): ArchitectureModel? {
    val deepMin = s.sleepDeepSeconds?.minutes() ?: return null
    val remMin = s.sleepRemSeconds?.minutes() ?: return null
    val result = SleepRules.architecture(deepMin, remMin, awakeMin ?: return null, asleepMin ?: return null) ?: return null
    val band = SleepRules.architectureBand(result.score.toDouble())
    return ArchitectureModel(
        gauge = GaugeModel(
            label = UiText.of(R.string.architecture_title),
            value = result.score.toDouble(),
            max = 100.0,
            valueText = fmt.number(result.score.toDouble(), 0),
            stateText = band?.text(),
            tone = band?.tone,
        ),
        parts = listOf(
            ArchitecturePart(UiText.of(R.string.stage_deep), result.deepScore.toFloat()),
            ArchitecturePart(UiText.of(R.string.stage_rem), result.remScore.toFloat()),
            ArchitecturePart(UiText.of(R.string.stage_awake), result.awakeScore.toFloat()),
        ),
    )
}

private fun tile(label: Int, value: String, unit: Int, band: Band?, series: List<Double>) =
    StatusTileModel(UiText.of(label), value, UiText.of(unit), band?.text(), band?.tone, series)

private fun vitals(s: Summary, chart: (Metric) -> List<Double>, fmt: Formatters): List<StatusTileModel> = buildList {
    s.sleepHr?.let { add(tile(R.string.metric_heart_rate, fmt.number(it, 0), R.string.unit_bpm, null, chart(Metric.SleepHr))) }
    s.sleepResp?.let { add(tile(R.string.metric_respiration, fmt.number(it, 1), R.string.unit_brpm, io.github.bridgemouse.bacta.domain.ReadinessRules.respirationBand(it), chart(Metric.SleepResp))) }
    s.sleepStress?.let { add(tile(R.string.metric_sleep_stress, fmt.number(it, 0), R.string.unit_avg, io.github.bridgemouse.bacta.domain.ReadinessRules.sleepStressBand(it), chart(Metric.SleepStress))) }
    s.sleepSpo2?.let { add(tile(R.string.metric_spo2, fmt.number(it, 0), R.string.unit_percent, io.github.bridgemouse.bacta.domain.ReadinessRules.spo2Band(it), chart(Metric.SleepSpo2))) }
}
