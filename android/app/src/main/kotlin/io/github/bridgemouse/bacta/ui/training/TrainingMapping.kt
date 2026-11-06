package io.github.bridgemouse.bacta.ui.training

import androidx.annotation.StringRes
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Activity
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.data.repository.WeekValue
import io.github.bridgemouse.bacta.data.repository.WeeklyIntensity
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.domain.TrainingRules
import io.github.bridgemouse.bacta.domain.TrainingStatus
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.ChipModel
import io.github.bridgemouse.bacta.ui.designsystem.components.HeadlineModel
import io.github.bridgemouse.bacta.ui.designsystem.components.MetricCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendCardModel
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendSectionModel
import io.github.bridgemouse.bacta.ui.format.Formatters
import io.github.bridgemouse.bacta.ui.metrics.MetricCatalog
import io.github.bridgemouse.bacta.ui.metrics.TrendSpec
import io.github.bridgemouse.bacta.ui.metrics.buildTrendSections
import io.github.bridgemouse.bacta.ui.metrics.periodOf
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.roundToInt

private typealias Points = Map<Metric, Result<List<TrendPoint>>>

/** Fitness age and VO₂ max move over weeks, so their charts always show a month whatever window the user picked. */
const val SlowTrendDays = 30

val TrainingFastMetrics: Set<Metric> = setOf(Metric.TrainingLoad, Metric.IntensityMod, Metric.IntensityVig, Metric.Steps, Metric.CaloriesTotal)
val TrainingSlowMetrics: Set<Metric> = setOf(Metric.FitnessAge, Metric.Vo2Max)

private val LoadSpec = TrendSpec(UiText.of(R.string.rail_training_load), Metric.TrainingLoad, UiText.of(R.string.cap_training_load))
private val FitnessAgeSpec = TrendSpec(UiText.of(R.string.rail_fitness_age), Metric.FitnessAge, UiText.of(R.string.cap_fitness_age))
private val Vo2Spec = TrendSpec(UiText.of(R.string.rail_vo2max), Metric.Vo2Max, UiText.of(R.string.cap_vo2max))
private val IntensitySpec = TrendSpec(UiText.of(R.string.rail_intensity), Metric.IntensityVig, UiText.of(R.string.cap_intensity))
private val StepsSpec = TrendSpec(UiText.of(R.string.rail_steps), Metric.Steps, UiText.of(R.string.cap_steps))
private val CaloriesSpec = TrendSpec(UiText.of(R.string.rail_calories), Metric.CaloriesTotal, UiText.of(R.string.cap_calories))

private val ZoneLabels = listOf(R.string.zone_warm_up, R.string.zone_easy, R.string.zone_aerobic, R.string.zone_threshold, R.string.zone_maximum)

private val KnownActivities: Map<String, Int> = mapOf(
    "running" to R.string.activity_running,
    "trail_running" to R.string.activity_trail_running,
    "walking" to R.string.activity_walking,
    "hiking" to R.string.activity_hiking,
    "cycling" to R.string.activity_cycling,
    "strength_training" to R.string.activity_strength_training,
    "multi_sport" to R.string.activity_multi_sport,
)

/** The user's own name for the activity when there is one; otherwise a localized label for known types, and a readable one for anything Garmin adds later. */
fun activityTitle(typeKey: String, name: String?): UiText {
    name?.trim()?.takeIf { it.isNotEmpty() }?.let { return UiText.Literal(it) }
    KnownActivities[typeKey]?.let { return UiText.of(it) }
    return UiText.Literal(typeKey.split('_').filter { it.isNotEmpty() }.joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } })
}

fun toTrainingContent(
    summary: Summary,
    fast: Points,
    slow: Points,
    activities: List<Activity>,
    volume: List<WeekValue>,
    avgHr: List<WeekValue>,
    intensity: WeeklyIntensity?,
    targets: Targets,
    fmt: Formatters,
): TrainingContent {
    fun series(points: Points, metric: Metric): List<TrendPoint> = points[metric]?.getOrNull().orEmpty()
    fun trend(spec: TrendSpec, points: Points, days: Int) = buildTrendSections(
        listOf(spec), summary, { series(points, it).map { p -> p.value } }, fmt, days,
        labels = { metric -> series(points, metric).map { fmt.weekdayInitial(it.date) } },
    )
    return TrainingContent(
        status = status(summary, fmt),
        performance = PerformanceModel(loadHeadline(summary, series(fast, Metric.TrainingLoad).map { it.value }, fmt), fitnessAgeCard(summary, fmt), vo2Card(summary, fmt)),
        loadRatio = loadRatio(summary, fmt),
        intensity = intensity?.let { intensityCard(it, targets, fmt) },
        zones = zones(summary, fmt),
        stepsChart = stepsChart(summary, series(fast, Metric.Steps), targets.trendDays, fmt),
        daily = dailyTiles(summary, targets, fmt),
        activities = activities.sortedByDescending { it.start }.map { activityRow(it, fmt) },
        trends = buildList {
            addAll(trend(LoadSpec, fast, targets.trendDays))
            weeklySection(R.string.rail_weekly_volume, R.string.metric_training_volume, R.string.unit_hours, R.string.cap_weekly_volume, volume, 1, TrendKind.Bars, fmt)?.let(::add)
            addAll(trend(FitnessAgeSpec, slow, SlowTrendDays))
            weeklySection(R.string.rail_activity_hr, R.string.metric_activity_hr, R.string.unit_bpm, R.string.cap_activity_hr, avgHr, 0, TrendKind.Line, fmt)?.let(::add)
            addAll(trend(Vo2Spec, slow, SlowTrendDays))
            addAll(trend(IntensitySpec, fast, targets.trendDays))
            addAll(trend(StepsSpec, fast, targets.trendDays))
            addAll(trend(CaloriesSpec, fast, targets.trendDays))
        },
    )
}

private fun status(s: Summary, fmt: Formatters): StatusModel? {
    val label = TrainingStatus.label(s.trainingStatusN) ?: return null
    val date = s.trainingStatusDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    return StatusModel(UiText.Literal(label), date?.let { UiText.of(R.string.as_of, fmt.shortDate(it)) })
}

private fun loadRatio(s: Summary, fmt: Formatters): LoadRatioModel? {
    val ratio = TrainingRules.loadRatio(s.trainingLoad, s.trainingLoadMin, s.trainingLoadMax) ?: return null
    return LoadRatioModel(
        value = UiText.Literal(fmt.number(ratio.value, 2)),
        state = ChipModel(UiText.Literal(ratio.state.label), ratio.state.tone),
        position = TrainingRules.ratioTrackPosition(ratio.value),
        optimalStart = TrainingRules.ratioTrackPosition(TrainingRules.OPTIMAL_LOW),
        optimalEnd = TrainingRules.ratioTrackPosition(TrainingRules.OPTIMAL_HIGH),
        caption = UiText.of(R.string.load_ratio_caption, fmt.number(s.trainingLoad ?: 0.0, 0), fmt.number(ratio.chronic, 0)),
        zoneLabel = UiText.of(R.string.load_ratio_zone, fmt.number(TrainingRules.OPTIMAL_LOW, 1), fmt.number(TrainingRules.OPTIMAL_HIGH, 1)),
    )
}

private fun loadHeadline(s: Summary, series: List<Double>, fmt: Formatters): HeadlineModel {
    val load = s.trainingLoad
    val low = s.trainingLoadMin
    val high = s.trainingLoadMax
    val state = TrainingRules.loadState(load, low, high)
    return HeadlineModel(
        label = UiText.of(R.string.load_acute),
        value = load?.let { fmt.number(it, 0) },
        chips = listOfNotNull(state?.let { ChipModel(UiText.Literal(it.label), it.tone) }),
        series = series,
        average = series.takeIf { it.isNotEmpty() }?.average(),
        band = if (low != null && high != null) low..high else null,
        footnote = if (low != null && high != null) UiText.of(R.string.load_optimal_range, fmt.number(low, 0), fmt.number(high, 0)) else null,
    )
}

/** Fitness age is only ever Garmin's own figure: with none, the card shows a dash rather than falling back to chronological age. */
private fun fitnessAgeCard(s: Summary, fmt: Formatters): MetricCardModel = MetricCardModel(
    label = UiText.of(R.string.metric_fitness_age),
    value = s.fitnessAge?.let { UiText.Literal(fmt.number(it, 0)) },
    unit = UiText.of(R.string.unit_years),
    sub = if (s.fitnessAge != null) s.fitnessAgeAchievable?.let { UiText.of(R.string.fitness_achievable, fmt.number(it, 0)) } else null,
)

private fun vo2Card(s: Summary, fmt: Formatters): MetricCardModel = MetricCardModel(
    label = UiText.of(R.string.metric_vo2max),
    value = s.vo2max?.let { UiText.Literal(fmt.number(it, MetricCatalog.spec(Metric.Vo2Max).decimals)) },
    unit = UiText.of(R.string.unit_vo2),
)

private fun intensityCard(week: WeeklyIntensity, targets: Targets, fmt: Formatters): IntensityModel {
    val points = TrainingRules.intensityPoints(week.moderate, week.vigorous)
    val goal = targets.weeklyIntensityMinutes
    val (moderate, vigorous) = TrainingRules.intensityShares(week.moderate, week.vigorous, goal)
    return IntensityModel(
        value = UiText.Literal(fmt.number(points, 0)),
        goalLabel = UiText.of(R.string.intensity_goal, fmt.number(goal.toDouble(), 0)),
        moderateFraction = moderate,
        vigorousFraction = vigorous,
        legend = UiText.of(R.string.intensity_legend, fmt.number(week.moderate, 0), fmt.number(week.vigorous, 0)),
        met = points >= goal,
    )
}

private fun zones(s: Summary, fmt: Formatters): ZonesModel? {
    val percents = TrainingRules.zonePercents(s.hrZoneMinutes) ?: return null
    val items = s.hrZoneMinutes.mapIndexed { i, minutes ->
        val whole = (minutes ?: 0.0).roundToInt()
        ZoneItem(i + 1, UiText.of(ZoneLabels[i]), whole, fmt.duration(whole * 60.0) ?: UiText.of(R.string.duration_m, 0), percents[i])
    }
    return ZonesModel(items, items.sumOf { it.minutes })
}

/** Rings need a goal to mean anything: the server supplies steps and floors, the user's targets supply the rest, and with none the tile is just a number. */
private fun stepsChart(s: Summary, points: List<TrendPoint>, days: Int, fmt: Formatters): StepsChartModel? {
    if (points.size < 2) return null
    val goal = s.stepsGoal?.takeIf { it > 0 }
    val remaining = goal?.let { it - (s.steps ?: 0.0) }
    return StepsChartModel(
        series = points.map { it.value },
        labels = points.map { fmt.weekdayInitial(it.date) },
        goal = goal,
        status = when {
            remaining == null || s.steps == null -> null
            remaining <= 0 -> UiText.of(R.string.goal_met)
            else -> UiText.of(R.string.steps_to_go, fmt.number(remaining, 0))
        },
        period = periodOf(days),
    )
}

private fun dailyTiles(s: Summary, targets: Targets, fmt: Formatters): List<MetricCardModel> {
    fun ring(value: Double?, goal: Double?): Float? =
        if (value != null && goal != null && goal > 0) (value / goal).coerceIn(0.0, 1.0).toFloat() else null
    fun goalText(goal: Double?, text: (Double) -> UiText): UiText? = goal?.takeIf { it > 0 }?.let { UiText.of(R.string.goal_value, text(it)) }
    fun count(goal: Double) = UiText.Literal(fmt.number(goal, 0))
    fun percent(r: Float?): UiText? = r?.let { UiText.of(R.string.value_percent, fmt.number(it * 100.0, 0)) }
    val distance = s.distanceMeters?.let(fmt::distance)
    val distanceGoal = targets.distanceMeters?.toDouble()
    return listOf(
        MetricCardModel(
            UiText.of(R.string.metric_steps), s.steps?.let { UiText.Literal(fmt.number(it, 0)) },
            sub = goalText(s.stepsGoal, ::count), ring = ring(s.steps, s.stepsGoal), ringText = percent(ring(s.steps, s.stepsGoal)),
        ),
        MetricCardModel(
            UiText.of(R.string.metric_distance), distance?.let { UiText.Literal(it.value) }, distance?.unit ?: UiText.of(R.string.unit_km),
            sub = goalText(distanceGoal) { m -> fmt.distance(m).let { UiText.of(R.string.value_with_unit, it.value, it.unit) } }, ring = ring(s.distanceMeters, distanceGoal), ringText = percent(ring(s.distanceMeters, distanceGoal)),
        ),
        MetricCardModel(
            UiText.of(R.string.metric_calories), s.caloriesTotal?.let { UiText.Literal(fmt.number(it, 0)) }, UiText.of(R.string.unit_kcal),
            sub = goalText(targets.caloriesTotal?.toDouble(), ::count), ring = ring(s.caloriesTotal, targets.caloriesTotal?.toDouble()), ringText = percent(ring(s.caloriesTotal, targets.caloriesTotal?.toDouble())),
        ),
        MetricCardModel(
            UiText.of(R.string.metric_active_cal), s.caloriesActive?.let { UiText.Literal(fmt.number(it, 0)) }, UiText.of(R.string.unit_kcal),
            sub = goalText(targets.caloriesActive?.toDouble(), ::count), ring = ring(s.caloriesActive, targets.caloriesActive?.toDouble()), ringText = percent(ring(s.caloriesActive, targets.caloriesActive?.toDouble())),
        ),
        MetricCardModel(
            UiText.of(R.string.metric_floors), s.floorsUp?.let { UiText.Literal(fmt.number(it, 0)) },
            sub = goalText(s.floorsGoal, ::count), ring = ring(s.floorsUp, s.floorsGoal), ringText = percent(ring(s.floorsUp, s.floorsGoal)),
        ),
    )
}

private fun activityRow(a: Activity, fmt: Formatters): ActivityRowModel {
    val missing = UiText.of(R.string.value_missing)
    val distance = a.distanceMeters?.takeIf { it > 0 }?.let(fmt::distance)
    return ActivityRowModel(
        id = a.id,
        title = activityTitle(a.typeKey, a.name),
        subtitle = fmt.dateTime(a.start.toInstant(ZoneOffset.UTC), ZoneOffset.UTC),
        stats = listOf(
            a.durationSeconds?.let(fmt::duration) ?: missing,
            distance?.let { UiText.of(R.string.value_with_unit, it.value, it.unit) } ?: missing,
            a.avgHr?.let { UiText.of(R.string.value_with_unit, fmt.number(it.toDouble(), 0), UiText.of(R.string.unit_bpm)) } ?: missing,
            a.calories?.let { UiText.of(R.string.value_with_unit, fmt.number(it.toDouble(), 0), UiText.of(R.string.unit_kcal)) } ?: missing,
        ),
    )
}

/** A weekly series from the server; the axis shows week numbers because the rail and period already say these are weeks. */
private fun weeklySection(
    @StringRes rail: Int, @StringRes label: Int, @StringRes unit: Int, @StringRes caption: Int,
    weeks: List<WeekValue>, decimals: Int, kind: TrendKind, fmt: Formatters,
): TrendSectionModel? {
    if (weeks.isEmpty()) return null
    return TrendSectionModel(
        UiText.of(rail),
        TrendCardModel(
            label = UiText.of(label),
            value = fmt.number(weeks.last().value, decimals),
            unit = UiText.of(unit),
            series = weeks.map { it.value },
            kind = kind,
            average = weeks.map { it.value }.average(),
            dayLabels = weeks.map { it.week.substringAfterLast('-').trimStart('0') },
            caption = UiText.of(caption),
            period = UiText.plural(R.plurals.period_weeks, weeks.size, weeks.size),
        ),
    )
}
