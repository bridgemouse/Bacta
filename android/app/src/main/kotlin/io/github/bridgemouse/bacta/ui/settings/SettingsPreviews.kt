package io.github.bridgemouse.bacta.ui.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.tooling.preview.Preview
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.LogEntry
import io.github.bridgemouse.bacta.domain.ServerUrlCheck
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.about.AboutScreen
import io.github.bridgemouse.bacta.ui.about.AboutUiState
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.format.LocaleFormatters
import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import io.github.bridgemouse.bacta.ui.format.MeasurementSystem
import io.github.bridgemouse.bacta.ui.logs.LogsScreen
import io.github.bridgemouse.bacta.ui.logs.LogsUiState
import java.util.Locale

// Synthetic data only.
private val formatters = LocaleFormatters(Locale.US, is24Hour = false) { MeasurementSystem.Imperial }

private val values = mapOf(
    "ai_provider" to "google", "ai_api_key" to "••••wxyz", "mx4_briefing_model" to "synthetic-model-a", "mx4_chat_model" to "synthetic-model-b",
    "mx4_nightly_enabled" to "true", "mx4_nightly_time" to "03:00", "mx4_on_sync_enabled" to "false", "garmin_background_sync_min" to "60",
)

private fun content(edit: EditState? = null, saving: Set<String> = emptySet(), connection: ConnectionState = ConnectionState.Idle) = SettingsContent(
    values = values,
    targets = Targets.Default.copy(caloriesTotal = 2400),
    servers = listOf(
        ServerRowModel("http://bacta.home/", inUse = true, check = ServerUrlCheck.Allowed),
        ServerRowModel("http://example.org/", inUse = false, check = ServerUrlCheck.CleartextBlocked("example.org")),
    ),
    edit = edit, saving = saving, connection = connection,
    models = mapOf("google" to listOf("synthetic-model-new", "synthetic-model-alt"), "anthropic" to listOf("synthetic-claude")),
)

@Composable
private fun Frame(ui: SettingsUiState) = BactaTheme {
    CompositionLocalProvider(LocalFormatters provides formatters) { SettingsScreen(ui, SettingsActions()) }
}

@Preview(widthDp = 412, heightDp = 1900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SettingsLoaded() = Frame(SettingsUiState.Content(content(connection = ConnectionState.Failed("synthetic provider message"))))

@Preview(widthDp = 412, heightDp = 900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SettingsValidationError() = Frame(
    SettingsUiState.Content(content(edit = EditState("mx4_chat_model", "model b", error = UiText.of(R.string.error_invalid)))),
)

@Preview(widthDp = 412, heightDp = 900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SettingsSaving() = Frame(
    SettingsUiState.Content(content(edit = EditState(TargetField.WeeklyIntensity.name, "200", saving = true), saving = setOf(TargetField.WeeklyIntensity.name))),
)

@Preview(widthDp = 412, heightDp = 300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun AboutLoaded() = BactaTheme { AboutScreen("0.0.0-preview", AboutUiState(loaded = true, serverVersion = "0.0.0-server")) }

@Preview(widthDp = 412, heightDp = 700, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun LogsLoaded() = BactaTheme {
    CompositionLocalProvider(LocalFormatters provides formatters) { LogsScreen(
        LogsUiState.Content(
            listOf("garmin", "mx4"), "garmin",
            listOf(
                LogEntry("garmin", "info", "Synthetic sync completed", java.time.Instant.parse("2026-11-04T03:00:12Z")),
                LogEntry("garmin", "error", "Synthetic failure example", java.time.Instant.parse("2026-11-03T03:00:09Z")),
                LogEntry("mx4", "warn", "Synthetic warning example", java.time.Instant.parse("2026-11-03T02:00:01Z")),
            ),
        ),
        onSelect = {}, onRefresh = {},
    ) }
}

@Preview(widthDp = 412, heightDp = 900, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun SettingsModelPicker() = Frame(SettingsUiState.Content(content(edit = EditState("mx4_chat_model", "synthetic-model-b"))))
