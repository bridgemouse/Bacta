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
)

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
