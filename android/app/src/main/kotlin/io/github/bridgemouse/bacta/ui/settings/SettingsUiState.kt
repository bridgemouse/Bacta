package io.github.bridgemouse.bacta.ui.settings

import io.github.bridgemouse.bacta.data.repository.PinChangeResult
import io.github.bridgemouse.bacta.domain.ServerUrlCheck
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.ui.UiText

/** The user goals that can be edited; [optional] ones can be cleared back to "not set". */
enum class TargetField(val optional: Boolean) {
    SleepMinutes(false),
    WeeklyIntensity(false),
    CaloriesTotal(true),
    CaloriesActive(true);

    fun read(t: Targets): Int? = when (this) {
        SleepMinutes -> t.sleepMinutes
        WeeklyIntensity -> t.weeklyIntensityMinutes
        CaloriesTotal -> t.caloriesTotal
        CaloriesActive -> t.caloriesActive
    }

    fun write(t: Targets, value: Int?): Targets = when (this) {
        SleepMinutes -> t.copy(sleepMinutes = value ?: t.sleepMinutes)
        WeeklyIntensity -> t.copy(weeklyIntensityMinutes = value ?: t.weeklyIntensityMinutes)
        CaloriesTotal -> t.copy(caloriesTotal = value)
        CaloriesActive -> t.copy(caloriesActive = value)
    }
}

/** An open edit dialog: [key] is a setting key or a [TargetField] name; [initial] is empty for secrets, which are never shown back. */
data class EditState(val key: String, val initial: String, val error: UiText? = null, val saving: Boolean = false, val custom: Boolean = false)

data class PinState(val saving: Boolean = false, val error: PinChangeResult? = null)

sealed interface ConnectionState {
    data object Idle : ConnectionState
    data object Testing : ConnectionState
    data object Ok : ConnectionState
    /** [detail] is the server's own message when it gave one. */
    data class Failed(val detail: String?) : ConnectionState
}

data class ServerRowModel(val url: String, val inUse: Boolean, val check: ServerUrlCheck)

data class SettingsContent(
    /** Server values for the in-use keys; the API key arrives masked. */
    val values: Map<String, String>,
    val targets: Targets,
    val servers: List<ServerRowModel>,
    val saving: Set<String> = emptySet(),
    val edit: EditState? = null,
    val message: UiText? = null,
    val connection: ConnectionState = ConnectionState.Idle,
    val pin: PinState? = null,
    /** Models each provider offers, from the server; empty when it could not be reached. */
    val models: Map<String, List<String>> = emptyMap(),
    /** Whether cards that open an explanation show a small cue; the user chooses in Settings. */
    val infoHints: Boolean = true,
)

/** Marks the "Custom…" row in the model picker; it does not match the server's model-id pattern, so it can never be a real model. */
const val CUSTOM_MODEL = "@custom"

/** The models to choose from for [key]: the current provider's list, with a saved model that is no longer listed kept at the front. */
fun SettingsContent.modelChoices(key: String): List<String> {
    val listed = models[values["ai_provider"]].orEmpty()
    val current = values[key]?.takeIf { it.isNotBlank() }
    return if (current != null && current !in listed) listOf(current) + listed else listed
}

sealed interface SettingsUiState {
    data object Loading : SettingsUiState
    data class Content(val content: SettingsContent) : SettingsUiState
    data object Error : SettingsUiState
}
