package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.domain.Tone
import java.time.Instant

/** A trend-capable metric. Recovery time is stored in minutes by the server and shown in hours. */
enum class Metric(val key: String, val divisor: Double = 1.0) {
    Hrv("hrv"),
    RestingHr("resting_hr"),
    StressAvg("stress_avg"),
    StressMax("stress_max"),
    RespAvg("resp_avg"),
    Spo2Avg("spo2_avg"),
    RecoveryScore("recovery_score"),
    RecoveryTime("recovery_time_h", divisor = 60.0),
    BodyBatteryWake("body_battery_wake"),
    SleepHr("sleep_hr"),
    SleepStress("sleep_stress"),
    SleepScore("sleep_score"),
    TrainingLoad("training_load"),
    SleepSeconds("sleep_s", divisor = 60.0),
    SleepDeep("sleep_deep_s", divisor = 60.0),
    SleepAwake("sleep_awake_s", divisor = 60.0),
    SleepResp("sleep_resp"),
    SleepSpo2("sleep_spo2"),
    Vo2Max("vo2max"),
    FitnessAge("fitness_age"),
    Steps("steps"),
    CaloriesTotal("calories_total"),
    BodyBatteryCurrent("body_battery_current"),
    IntensityMod("intensity_mod_min"),
    IntensityVig("intensity_vig_min"),
}

data class Summary(
    val hrv: Double? = null,
    val hrvWeekAvg: Double? = null,
    val restingHr: Double? = null,
    val stressAvg: Double? = null,
    val stressMax: Double? = null,
    val respAvg: Double? = null,
    val spo2Avg: Double? = null,
    val recoveryScore: Double? = null,
    val recoveryTimeHours: Double? = null,
    val bodyBatteryWake: Double? = null,
    val bodyBatteryCurrent: Double? = null,
    val hrvBaselineLow: Double? = null,
    val hrvBaselineHigh: Double? = null,
    val sleepHr: Double? = null,
    val sleepStress: Double? = null,
    val sleepScore: Double? = null,
    val sleepSeconds: Double? = null,
    val trainingLoad: Double? = null,
    val trainingStatusN: Double? = null,
    val trainingStatusDate: String? = null,
    val sleepDeepSeconds: Double? = null,
    val sleepLightSeconds: Double? = null,
    val sleepRemSeconds: Double? = null,
    val sleepAwakeSeconds: Double? = null,
    val sleepSpo2: Double? = null,
    val sleepResp: Double? = null,
    val distanceMeters: Double? = null,
    val steps: Double? = null,
    val stepsGoal: Double? = null,
    val caloriesTotal: Double? = null,
    val caloriesActive: Double? = null,
    val floorsUp: Double? = null,
    val floorsGoal: Double? = null,
    val vo2max: Double? = null,
    val fitnessAge: Double? = null,
    val fitnessAgeAchievable: Double? = null,
    val trainingLoadMin: Double? = null,
    val trainingLoadMax: Double? = null,
    /** Today's minutes in heart-rate zones 1 to 5; a slot is null when the server has no value for it. */
    val hrZoneMinutes: List<Double?> = List(5) { null },
)

data class TrendPoint(val date: java.time.LocalDate, val value: Double)

/** `start` is Garmin's local wall-clock time, which carries no zone, so it is not an Instant. */
data class Activity(
    val id: String,
    val typeKey: String,
    val name: String?,
    val start: java.time.LocalDateTime,
    val durationSeconds: Double?,
    val distanceMeters: Double?,
    val avgHr: Int?,
    val calories: Int?,
)

data class WeekValue(val week: String, val value: Double)

data class WeeklyIntensity(val moderate: Double, val vigorous: Double)

data class Briefing(
    val tone: Tone,
    val headline: String,
    val summary: String?,
    val body: String,
    val recommendation: String,
    val flags: List<String>,
    val generatedAt: Instant,
    val model: String?,
)

data class AuthStatus(val configured: Boolean, val authed: Boolean)

sealed interface LoginResult {
    data object Success : LoginResult
    data object WrongPin : LoginResult
    data object Failure : LoginResult
}

sealed interface Compatibility {
    data object Ok : Compatibility
    data class AppTooOld(val minApp: String) : Compatibility
    data object Unreachable : Compatibility
}

/** The summary's latest value for a metric, or null when the summary carries none (single place that maps metrics to summary fields). */
fun Summary.valueOf(metric: Metric): Double? = when (metric) {
    Metric.Hrv -> hrv
    Metric.RestingHr -> restingHr
    Metric.StressAvg -> stressAvg
    Metric.StressMax -> null
    Metric.RespAvg -> respAvg
    Metric.Spo2Avg -> spo2Avg
    Metric.RecoveryScore -> recoveryScore
    Metric.RecoveryTime -> recoveryTimeHours
    Metric.BodyBatteryWake -> bodyBatteryWake
    Metric.SleepHr -> sleepHr
    Metric.SleepStress -> sleepStress
    Metric.SleepScore -> sleepScore
    Metric.TrainingLoad -> trainingLoad
    Metric.BodyBatteryCurrent -> bodyBatteryCurrent
    Metric.IntensityMod, Metric.IntensityVig -> null
    Metric.SleepSeconds -> sleepSeconds?.div(metric.divisor)
    Metric.SleepDeep -> sleepDeepSeconds?.div(metric.divisor)
    Metric.SleepAwake -> sleepAwakeSeconds?.div(metric.divisor)
    Metric.SleepResp -> sleepResp
    Metric.SleepSpo2 -> sleepSpo2
    Metric.Vo2Max -> vo2max
    Metric.FitnessAge -> fitnessAge
    Metric.Steps -> steps
    Metric.CaloriesTotal -> caloriesTotal
}

/** A server-provided reference average for a metric (the HRV week average), used as the chart's average line and the delta baseline. */
fun Summary.referenceAverage(metric: Metric): Double? = if (metric == Metric.Hrv) hrvWeekAvg else null
