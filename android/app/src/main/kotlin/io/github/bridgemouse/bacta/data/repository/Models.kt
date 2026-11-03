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
}

data class Summary(
    val hrv: Double?,
    val restingHr: Double?,
    val stressAvg: Double?,
    val stressMax: Double?,
    val respAvg: Double?,
    val spo2Avg: Double?,
    val recoveryScore: Double?,
    val recoveryTimeHours: Double?,
    val bodyBatteryWake: Double?,
    val bodyBatteryCurrent: Double?,
    val hrvBaselineLow: Double?,
    val hrvBaselineHigh: Double?,
    val sleepHr: Double?,
    val sleepStress: Double?,
    val sleepScore: Double?,
    val trainingLoad: Double?,
    val trainingStatusN: Double?,
    val trainingStatusDate: String?,
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
