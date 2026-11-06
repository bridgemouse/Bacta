package io.github.bridgemouse.bacta.domain

/** A server setting the app edits. [secret] values come back masked and are only ever written when the user types a new one. */
data class SettingKey(val key: String, val secret: Boolean = false) {
    companion object {
        val AiProvider = SettingKey("ai_provider")
        val AiApiKey = SettingKey("ai_api_key", secret = true)
        val BriefingModel = SettingKey("mx4_briefing_model")
        val ChatModel = SettingKey("mx4_chat_model")
        val NightlyEnabled = SettingKey("mx4_nightly_enabled")
        val NightlyTime = SettingKey("mx4_nightly_time")
        val OnSyncEnabled = SettingKey("mx4_on_sync_enabled")
        val GarminSyncMinutes = SettingKey("garmin_background_sync_min")

        /** Only keys this app has a control for; the server holds many more, which this screen must not touch. */
        val All = listOf(AiProvider, AiApiKey, BriefingModel, ChatModel, NightlyEnabled, NightlyTime, OnSyncEnabled, GarminSyncMinutes)
    }
}

/** Mirrors the per-key validators in `server/api/settings.ts`, so a bad value is caught before the request and the server stays the authority. */
object SettingsValidation {
    val AiProviders = listOf("google", "anthropic", "openai")
    const val MIN_SYNC_MINUTES = 15
    const val MASK = '•'

    private val model = Regex("^[\\w.\\-:]{1,60}$")
    private val time = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")
    private val minutes = Regex("^\\d{1,4}$")
    private val pin = Regex("^\\d{4,12}$")
    private fun bool(v: String) = v == "true" || v == "false"

    private val validators: Map<String, (String) -> Boolean> = mapOf(
        "ai_provider" to { v -> v in AiProviders },
        "ai_api_key" to { v -> v.length <= 400 },
        "mx4_briefing_model" to { v -> model.matches(v) },
        "mx4_chat_model" to { v -> model.matches(v) },
        "mx4_nightly_enabled" to ::bool,
        "mx4_on_sync_enabled" to ::bool,
        "mx4_nightly_time" to { v -> time.matches(v) },
        "garmin_background_sync_min" to { v -> minutes.matches(v) && (v.toInt() == 0 || v.toInt() >= MIN_SYNC_MINUTES) },
    )

    fun hasValidator(key: String): Boolean = key in validators

    fun validate(key: String, value: String): Boolean = validators[key]?.invoke(value) ?: false

    fun isPinFormat(value: String): Boolean = pin.matches(value)

    /** The server masks a stored secret as bullets plus its last four characters; echoing that back would overwrite the real key. */
    fun isMasked(value: String): Boolean = value.startsWith(MASK)
}
