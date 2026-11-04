package io.github.bridgemouse.bacta.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

val BactaJson = Json { ignoreUnknownKeys = true }

@Serializable
data class VersionDto(val server: String, @SerialName("minApp") val minApp: String)

@Serializable
data class AuthStatusDto(val configured: Boolean, val authed: Boolean)

@Serializable
data class LoginRequest(val pin: String)

@Serializable
data class OkDto(val ok: Boolean = false, val error: String? = null)

/** Latest value per metric; the server omits a metric it has never received, so every field is nullable. */
@Serializable
data class SummaryDto(
    val hrv: Double? = null,
    @SerialName("resting_hr") val restingHr: Double? = null,
    @SerialName("stress_avg") val stressAvg: Double? = null,
    @SerialName("stress_max") val stressMax: Double? = null,
    @SerialName("resp_avg") val respAvg: Double? = null,
    @SerialName("spo2_avg") val spo2Avg: Double? = null,
    @SerialName("recovery_score") val recoveryScore: Double? = null,
    @SerialName("recovery_time_h") val recoveryTimeH: Double? = null,
    @SerialName("body_battery_wake") val bodyBatteryWake: Double? = null,
    @SerialName("body_battery_current") val bodyBatteryCurrent: Double? = null,
    @SerialName("hrv_week_avg") val hrvWeekAvg: Double? = null,
    @SerialName("sleep_s") val sleepS: Double? = null,
    @SerialName("sleep_deep_s") val sleepDeepS: Double? = null,
    @SerialName("sleep_light_s") val sleepLightS: Double? = null,
    @SerialName("sleep_rem_s") val sleepRemS: Double? = null,
    @SerialName("hrv_baseline_low") val hrvBaselineLow: Double? = null,
    @SerialName("hrv_baseline_high") val hrvBaselineHigh: Double? = null,
    @SerialName("sleep_hr") val sleepHr: Double? = null,
    @SerialName("sleep_stress") val sleepStress: Double? = null,
    @SerialName("sleep_score") val sleepScore: Double? = null,
    @SerialName("training_load") val trainingLoad: Double? = null,
    @SerialName("training_status_n") val trainingStatusN: Double? = null,
    @SerialName("training_status_n_date") val trainingStatusDate: String? = null,
)

@Serializable
data class TrendRowDto(
    val date: String,
    val value: Double? = null,
    val unit: String? = null,
    val metric: String? = null,
)

@Serializable
data class TrendDto(val rows: List<TrendRowDto> = emptyList())

/** `generatedAt == null` is how the server marks its built-in placeholder briefing. */
@Serializable
data class BriefingDto(
    val tone: String,
    val headline: String,
    val summary: String? = null,
    val body: String = "",
    val recommendation: String = "",
    val flags: List<JsonElement> = emptyList(),
    @SerialName("generated_at") val generatedAt: String? = null,
    val model: String? = null,
)
