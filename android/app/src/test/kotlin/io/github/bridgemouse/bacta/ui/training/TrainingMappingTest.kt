package io.github.bridgemouse.bacta.ui.training

import io.github.bridgemouse.bacta.data.repository.Activity
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.TrendPoint
import io.github.bridgemouse.bacta.data.repository.WeekValue
import io.github.bridgemouse.bacta.data.repository.WeeklyIntensity
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.format.LocaleFormatters
import io.github.bridgemouse.bacta.ui.format.MeasurementSystem
import java.io.IOException
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Locale
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

private typealias Points = Map<Metric, Result<List<TrendPoint>>>

class TrainingMappingTest {
    private val today = LocalDate.of(2026, 11, 4)
    private val failed: Points = Metric.entries.associateWith { Result.failure(IOException("x")) }
    private fun week(vararg v: Double) = v.mapIndexed { i, x -> TrendPoint(today.minusDays((v.size - 1 - i).toLong()), x) }
    private fun ok(vararg p: Pair<Metric, List<TrendPoint>>): Points = failed + p.associate { (m, s) -> m to Result.success(s) }

    // Synthetic numbers only; the optimal range 200..375 gives a chronic load of 250.
    private val day = Summary(
        trainingLoad = 300.0, trainingLoadMin = 200.0, trainingLoadMax = 375.0,
        trainingStatusN = 4.0, trainingStatusDate = "2026-11-02",
        vo2max = 48.0, fitnessAge = 36.0, fitnessAgeAchievable = 33.0,
        steps = 5000.0, stepsGoal = 10000.0, distanceMeters = 8046.72, caloriesTotal = 2200.0, caloriesActive = 500.0,
        floorsUp = 6.0, floorsGoal = 10.0, hrZoneMinutes = listOf(10.0, 20.0, 15.0, 5.0, 0.0),
    )

    private fun map(
        s: Summary,
        p: Points = failed,
        slow: Points = failed,
        activities: List<Activity> = emptyList(),
        volume: List<WeekValue> = emptyList(),
        avgHr: List<WeekValue> = emptyList(),
        intensity: WeeklyIntensity? = null,
        t: Targets = Targets.Default,
        fmt: io.github.bridgemouse.bacta.ui.format.Formatters = testFormatters,
    ) = toTrainingContent(s, p, slow, activities, volume, avgHr, intensity, t, fmt)

    @Test
    fun nullMetricsRenderDashesAndNoRings() {
        val c = map(Summary())
        assertNull(c.status)
        assertNull(c.performance.load.value); assertNull(c.performance.fitnessAge.value); assertNull(c.performance.vo2max.value)
        assertNull(c.intensity); assertNull(c.zones)
        assertEquals(5, c.daily.size)
        assertTrue(c.daily.all { it.value == null && it.ring == null })
        assertTrue(c.activities.isEmpty()); assertTrue(c.trends.isEmpty())
    }

    @Test
    fun onlyKnownGoalsDrawRings() {
        val rings = map(day).daily.associate { it.label.s() to it.ring }
        assertEquals(0.5f, rings["Steps"])
        assertEquals(0.6f, rings["Floors"])
        assertNull(rings["Distance"]); assertNull(rings["Calories"]); assertNull(rings["Active cal"])
        val withGoals = map(day, t = Targets.Default.copy(distanceMeters = 16093, caloriesTotal = 4400, caloriesActive = 1000)).daily.associate { it.label.s() to it.ring }
        assertEquals(0.5f, withGoals["Distance"]!!, 0.001f)
        assertEquals(0.5f, withGoals["Calories"])
        assertEquals(0.5f, withGoals["Active cal"])
    }

    @Test
    fun aRingNeverExceedsFullOrDividesByZero() {
        val over = map(day.copy(steps = 25000.0)).daily.first { it.label.s() == "Steps" }
        assertEquals(1f, over.ring)
        val noGoal = map(day.copy(stepsGoal = 0.0)).daily.first { it.label.s() == "Steps" }
        assertNull(noGoal.ring)
    }

    @Test
    fun distanceFollowsTheLocale() {
        val miles = map(day).daily.first { it.label.s() == "Distance" }
        assertEquals("5.0", miles.value.s()); assertEquals("mi", miles.unit.s())
        val metric = LocaleFormatters(Locale.US, false) { MeasurementSystem.Metric }
        val km = map(day, fmt = metric).daily.first { it.label.s() == "Distance" }
        assertEquals("8.0", km.value.s()); assertEquals("km", km.unit.s())
    }

    @Test
    fun fitnessAgeNeverFallsBackToChronologicalAge() {
        val none = map(Summary(fitnessAge = null, fitnessAgeAchievable = 33.0)).performance.fitnessAge
        assertNull(none.value); assertNull(none.sub)
        val some = map(day).performance.fitnessAge
        assertEquals("36", some.value.s())
        assertEquals("achievable 33", some.sub.s())
    }

    @Test
    fun theLoadHeadlineUsesGarminsRangeAndRatio() {
        val load = map(day).performance.load
        assertEquals("300", load.value)
        assertEquals(listOf("Optimal"), load.chips.map { it.text.s() })
        assertNull(load.sub)
        assertEquals("optimal 200–375", load.footnote.s())
        assertEquals(200.0..375.0, load.band)
    }

    @Test
    fun statusSubShowsTheMeasurementDate() {
        val status = assertNotNull(map(day).status)
        assertEquals("Maintaining", status.value.s())
        assertEquals("as of 11/2/26", status.sub.s())
        assertNull(map(day.copy(trainingStatusN = 0.0)).status)
    }

    @Test
    fun intensityCardSplitsModerateAndVigorousAgainstTheUsersGoal() {
        val m = assertNotNull(map(day, intensity = WeeklyIntensity(95.0, 20.0)).intensity)
        assertEquals("135", m.value.s())
        assertEquals("goal 150 min", m.goalLabel.s())
        assertEquals(0.6333f, m.moderateFraction, 0.001f)
        assertEquals(0.2667f, m.vigorousFraction, 0.001f)
        assertEquals("Moderate 95 · Vigorous 20 (counts double)", m.legend.s())
        assertEquals(false, m.met)
        val met = assertNotNull(map(day, intensity = WeeklyIntensity(95.0, 20.0), t = Targets.Default.copy(weeklyIntensityMinutes = 120)).intensity)
        assertEquals(true, met.met)
    }

    @Test
    fun zonesSumToOneHundredAndAreAbsentWithoutTime() {
        val zones = assertNotNull(map(day).zones)
        assertEquals(100, zones.items.sumOf { it.percent })
        assertEquals(listOf("Warm up", "Easy", "Aerobic", "Threshold", "Maximum"), zones.items.map { it.label.s() })
        assertEquals(50, zones.totalMinutes)
        assertNull(map(day.copy(hrZoneMinutes = listOf(0.0, null, 0.0, null, null))).zones)
    }

    @Test
    fun unknownActivityTypeGetsAReadableLabel() {
        fun title(type: String, name: String?) = activityTitle(type, name).s()
        assertEquals("Padel Sport", title("padel_sport", null))
        assertEquals("Trail running", title("trail_running", null))
        assertEquals("Synthetic Name", title("running", "Synthetic Name"))
        assertEquals("Running", title("running", "  "))
    }

    @Test
    fun partialActivityShowsDashes() {
        val row = map(day, activities = listOf(Activity("1", "walking", null, LocalDateTime.of(2026, 11, 3, 18, 0), null, null, null, null))).activities.single()
        assertEquals("Walking", row.title.s())
        assertEquals(listOf("—", "—", "—", "—"), row.stats.map { it.s() })
    }

    @Test
    fun aFullActivityFormatsEveryStat() {
        val a = Activity("2", "running", "Synthetic Run", LocalDateTime.of(2026, 11, 3, 7, 15), 1800.0, 5000.0, 150, 400)
        val row = map(day, activities = listOf(a)).activities.single()
        assertEquals("Synthetic Run", row.title.s())
        assertEquals(listOf("30m", "3.1 mi", "150 bpm", "400 kcal"), row.stats.map { it.s() })
        assertTrue(row.subtitle.s()!!.contains("7:15"), row.subtitle.s())
    }

    @Test
    fun trendsHaveEightSectionsFromSpecs() {
        val series = week(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
        val c = map(
            day,
            p = ok(Metric.TrainingLoad to series, Metric.Steps to series, Metric.CaloriesTotal to series, Metric.IntensityMod to series, Metric.IntensityVig to series),
            slow = ok(Metric.FitnessAge to series, Metric.Vo2Max to series),
            volume = listOf(WeekValue("2026-43", 4.5), WeekValue("2026-44", 6.25)),
            avgHr = listOf(WeekValue("2026-43", 148.0), WeekValue("2026-44", 151.0)),
        )
        assertEquals(
            listOf("TRAINING LOAD", "WEEKLY VOLUME", "FITNESS AGE", "ACTIVITY HEART RATE", "VO₂ MAX", "INTENSITY", "STEPS", "CALORIES"),
            c.trends.map { it.rail.s() },
        )
        assertEquals(listOf("43", "44"), c.trends[1].card.dayLabels)
    }

    @Test
    fun theTrendWindowChangesTheFastCaptionsButSlowMetricsKeepThirtyDays() {
        val series = week(1.0, 2.0, 3.0)
        val c = map(day, p = ok(Metric.TrainingLoad to series), slow = ok(Metric.FitnessAge to series), t = Targets.Default.copy(trendDays = 14))
        assertEquals("14 days", c.trends.first { it.rail.s() == "TRAINING LOAD" }.card.period.s())
        assertEquals("30 days", c.trends.first { it.rail.s() == "FITNESS AGE" }.card.period.s())
    }

    @Test
    fun theLoadHeadlineCarriesTheDrawnSeriesAndStepsHaveNoCrowdingUnit() {
        val c = map(day, p = ok(Metric.TrainingLoad to week(1.0, 2.0, 3.0)))
        assertEquals(listOf(1.0, 2.0, 3.0), c.performance.load.series)
        assertNull(c.daily.first { it.label.s() == "Steps" }.unit)
    }

    @Test
    fun theIntensityTrendShowsTodaysVigorousMinutes() {
        val c = map(day.copy(intensityVigMin = 12.0), p = ok(Metric.IntensityVig to week(0.0, 5.0, 12.0)))
        assertEquals("12", c.trends.first { it.rail.s() == "INTENSITY" }.card.value)
    }

    @Test
    fun vo2MaxKeepsGarminsDecimal() {
        assertEquals("48.4", map(day.copy(vo2max = 48.4)).performance.vo2max.value.s())
    }

    @Test
    fun loadRatioModelCarriesValueStateAndTrackPosition() {
        val r = assertNotNull(map(day).loadRatio)
        assertEquals("1.20", r.value.s())
        assertEquals("Optimal", r.state?.text.s())
        assertEquals(0.4667f, r.position, 0.001f)
        assertEquals("300 acute · 250 chronic", r.caption.s())
        assertEquals("optimal 0.8–1.5", r.zoneLabel.s())
    }

    @Test
    fun noRatioWhenThereIsNoRange() {
        assertNull(map(Summary(trainingLoad = 300.0)).loadRatio)
        assertNull(map(Summary()).loadRatio)
    }

    @Test
    fun zoneRowsCarryFormattedMinutes() {
        val zones = assertNotNull(map(day).zones)
        assertEquals(listOf("10m", "20m", "15m", "5m", "0m"), zones.items.map { it.minutesText.s() })
    }

    private val stepsWeek = week(3000.0, 4000.0, 5000.0, 6000.0, 7000.0, 8000.0, 9000.0)

    @Test
    fun stepsChartHasTheGoalAndWhatRemains() {
        val chart = assertNotNull(map(day, p = ok(Metric.Steps to stepsWeek)).stepsChart)
        assertEquals(7, chart.series.size)
        assertEquals(10000.0, chart.goal)
        assertEquals("5,000 TO GO", chart.status.s())
        assertEquals("7 days", chart.period.s())
    }

    @Test
    fun reachingTheStepGoalSaysGoalMet() {
        assertEquals("GOAL MET", map(day.copy(steps = 12000.0), p = ok(Metric.Steps to stepsWeek)).stepsChart?.status.s())
    }

    @Test
    fun noGoalMeansNoGoalLineAndNoStatus() {
        val chart = assertNotNull(map(day.copy(stepsGoal = null), p = ok(Metric.Steps to stepsWeek)).stepsChart)
        assertNull(chart.goal); assertNull(chart.status)
    }

    @Test
    fun oneStepPointDrawsNoChart() {
        assertNull(map(day, p = ok(Metric.Steps to week(5000.0))).stepsChart)
    }

    @Test
    fun ringTilesShowAPercent() {
        val steps = map(day).daily.first { it.label.s() == "Steps" }
        assertEquals("50%", steps.ringText.s())
        assertNull(map(day).daily.first { it.label.s() == "Distance" }.ringText)
    }
}
