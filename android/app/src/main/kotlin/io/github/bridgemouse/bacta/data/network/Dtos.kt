package io.github.bridgemouse.bacta.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

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
    @SerialName("sleep_awake_s") val sleepAwakeS: Double? = null,
    @SerialName("sleep_spo2") val sleepSpo2: Double? = null,
    @SerialName("sleep_resp") val sleepResp: Double? = null,
    @SerialName("distance_m") val distanceM: Double? = null,
    val steps: Double? = null,
    @SerialName("steps_goal") val stepsGoal: Double? = null,
    @SerialName("calories_total") val caloriesTotal: Double? = null,
    @SerialName("calories_active") val caloriesActive: Double? = null,
    @SerialName("floors_up") val floorsUp: Double? = null,
    @SerialName("floors_goal") val floorsGoal: Double? = null,
    val vo2max: Double? = null,
    @SerialName("fitness_age") val fitnessAge: Double? = null,
    @SerialName("fitness_age_achievable") val fitnessAgeAchievable: Double? = null,
    @SerialName("training_load_min") val trainingLoadMin: Double? = null,
    @SerialName("training_load_max") val trainingLoadMax: Double? = null,
    @SerialName("intensity_mod_min") val intensityModMin: Double? = null,
    @SerialName("intensity_vig_min") val intensityVigMin: Double? = null,
    @SerialName("hrzone_1_min") val hrzone1Min: Double? = null,
    @SerialName("hrzone_2_min") val hrzone2Min: Double? = null,
    @SerialName("hrzone_3_min") val hrzone3Min: Double? = null,
    @SerialName("hrzone_4_min") val hrzone4Min: Double? = null,
    @SerialName("hrzone_5_min") val hrzone5Min: Double? = null,
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

/** Resampled hypnogram: 24 blocks of the server's stage level, plus Garmin's local-as-UTC start and end in milliseconds. */
@Serializable
data class HypnoDto(
    val hypno: List<Int> = emptyList(),
    val startLocal: Long? = null,
    val endLocal: Long? = null,
)

/** `activity_id` is TEXT in the database, so it may arrive as a string or a number. */
@Serializable
data class ActivityDto(
    @SerialName("activity_id") val activityId: JsonPrimitive,
    val date: String,
    @SerialName("start_time") val startTime: String,
    val name: String? = null,
    @SerialName("type_key") val typeKey: String,
    @SerialName("distance_m") val distanceM: Double? = null,
    @SerialName("duration_s") val durationS: Double? = null,
    val calories: Double? = null,
    @SerialName("avg_hr") val avgHr: Double? = null,
    @SerialName("elevation_m") val elevationM: Double? = null,
    @SerialName("aerobic_te") val aerobicTe: Double? = null,
    @SerialName("anaerobic_te") val anaerobicTe: Double? = null,
    @SerialName("recovery_time_h") val recoveryTimeH: Double? = null,
    @SerialName("zone1_s") val zone1S: Double? = null,
    @SerialName("zone2_s") val zone2S: Double? = null,
    @SerialName("zone3_s") val zone3S: Double? = null,
    @SerialName("zone4_s") val zone4S: Double? = null,
    @SerialName("zone5_s") val zone5S: Double? = null,
)

@Serializable
data class ActivitiesDto(val activities: List<ActivityDto> = emptyList())

@Serializable
data class WeekDto(
    val week: String,
    val hours: Double? = null,
    @SerialName("avg_hr") val avgHr: Double? = null,
)

@Serializable
data class WeeksDto(val weeks: List<WeekDto> = emptyList())

@Serializable
data class IntensityDto(val moderate: Double = 0.0, val vigorous: Double = 0.0)

@Serializable
data class SettingValueRequest(val value: String)

@Serializable
data class SetPinRequest(val pin: String, val currentPin: String? = null)

/** What the server's provider check answers; [error] is its own message when [ok] is false. */
@Serializable
data class TestConnectionDto(val ok: Boolean = false, val error: String? = null)

@Serializable
data class LogDto(val source: String, val level: String, val message: String, @SerialName("created_at") val createdAt: String)

@Serializable
data class LogsDto(val logs: List<LogDto> = emptyList())

@Serializable
data class LogSourcesDto(val sources: List<String> = emptyList())
