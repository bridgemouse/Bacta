package io.github.bridgemouse.bacta.ui.settings

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.ServerUrlCheck
import io.github.bridgemouse.bacta.domain.SettingKey
import io.github.bridgemouse.bacta.domain.SettingsValidation
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.RefreshableScroll
import io.github.bridgemouse.bacta.ui.designsystem.components.SettingRow
import io.github.bridgemouse.bacta.ui.designsystem.components.SettingSwitchRow
import io.github.bridgemouse.bacta.ui.designsystem.components.SettingsGroup
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.format.LocalFormatters

private val Accent = BactaPalette.Mx4
private val SyncChoices = listOf(0, 15, 30, 60, 120, 360)
private const val TREND_KEY = "trend_days"

@Composable
fun SettingsScreen(ui: SettingsUiState, actions: SettingsActions, modifier: Modifier = Modifier) {
    when (ui) {
        SettingsUiState.Loading -> StateMessage(StateKind.Loading, UiText.of(R.string.settings_loading), modifier)
        SettingsUiState.Error -> StateMessage(StateKind.Error, UiText.of(R.string.settings_error), modifier, onRetry = actions.refresh)
        is SettingsUiState.Content -> SettingsContentView(ui.content, actions, modifier)
    }
}

@Composable
private fun SettingsContentView(c: SettingsContent, a: SettingsActions, modifier: Modifier) {
    val fmt = LocalFormatters.current
    fun value(key: SettingKey) = c.values[key.key].orEmpty()
    fun flag(key: SettingKey) = value(key) == "true"
    val notSet = UiText.of(R.string.target_not_set)

    RefreshableScroll(false, a.refresh, modifier) {
        c.message?.let { SettingRow(it, null, supportingColor = null, onClick = a.dismissMessage) }
        SettingsGroup(UiText.of(R.string.group_mx4), Accent) {
            SettingRow(UiText.of(R.string.setting_ai_provider), UiText.Literal(value(SettingKey.AiProvider)), onClick = { a.startEdit(SettingKey.AiProvider.key) })
            SettingRow(UiText.of(R.string.setting_ai_api_key), UiText.Literal(value(SettingKey.AiApiKey)).takeIf { value(SettingKey.AiApiKey).isNotEmpty() } ?: notSet, onClick = { a.startEdit(SettingKey.AiApiKey.key) })
            SettingRow(UiText.of(R.string.setting_briefing_model), UiText.Literal(value(SettingKey.BriefingModel)), onClick = { a.startEdit(SettingKey.BriefingModel.key) })
            SettingRow(UiText.of(R.string.setting_chat_model), UiText.Literal(value(SettingKey.ChatModel)), onClick = { a.startEdit(SettingKey.ChatModel.key) })
            SettingSwitchRow(UiText.of(R.string.setting_nightly), flag(SettingKey.NightlyEnabled), { a.save(SettingKey.NightlyEnabled.key, it.toString()) }, Accent)
            SettingRow(UiText.of(R.string.setting_nightly_time), UiText.Literal(value(SettingKey.NightlyTime)), onClick = { a.startEdit(SettingKey.NightlyTime.key) })
            SettingSwitchRow(UiText.of(R.string.setting_on_sync), flag(SettingKey.OnSyncEnabled), { a.save(SettingKey.OnSyncEnabled.key, it.toString()) }, Accent)
            val connection = when (val s = c.connection) {
                ConnectionState.Idle -> null
                ConnectionState.Testing -> UiText.of(R.string.connection_testing)
                ConnectionState.Ok -> UiText.of(R.string.connection_ok)
                is ConnectionState.Failed -> s.detail?.let { UiText.of(R.string.connection_failed_detail, it) } ?: UiText.of(R.string.connection_failed)
            }
            SettingRow(UiText.of(R.string.setting_test_connection), null, supporting = connection, onClick = a.testConnection)
        }
        SettingsGroup(UiText.of(R.string.group_garmin), Accent) {
            val minutes = value(SettingKey.GarminSyncMinutes).toIntOrNull() ?: 0
            SettingRow(UiText.of(R.string.setting_garmin_sync), syncLabel(minutes), onClick = { a.startEdit(SettingKey.GarminSyncMinutes.key) })
        }
        SettingsGroup(UiText.of(R.string.group_targets), BactaPalette.accent(io.github.bridgemouse.bacta.domain.Section.Training)) {
            val t = c.targets
            SettingRow(UiText.of(R.string.target_sleep), fmt.duration(t.sleepMinutes * 60.0), onClick = { a.startEdit(TargetField.SleepMinutes.name) })
            SettingRow(UiText.of(R.string.target_intensity), UiText.of(R.string.value_with_unit, fmt.number(t.weeklyIntensityMinutes.toDouble(), 0), UiText.of(R.string.unit_min)), onClick = { a.startEdit(TargetField.WeeklyIntensity.name) })
            SettingRow(UiText.of(R.string.target_calories_total), t.caloriesTotal?.let { UiText.of(R.string.value_with_unit, fmt.number(it.toDouble(), 0), UiText.of(R.string.unit_kcal)) } ?: notSet, onClick = { a.startEdit(TargetField.CaloriesTotal.name) })
            SettingRow(UiText.of(R.string.target_calories_active), t.caloriesActive?.let { UiText.of(R.string.value_with_unit, fmt.number(it.toDouble(), 0), UiText.of(R.string.unit_kcal)) } ?: notSet, onClick = { a.startEdit(TargetField.CaloriesActive.name) })
            SettingRow(UiText.of(R.string.target_trend_window), io.github.bridgemouse.bacta.ui.metrics.periodOf(t.trendDays), onClick = { a.startEdit(TREND_KEY) })
        }
        SettingsGroup(UiText.of(R.string.group_servers), Accent) {
            c.servers.forEach { s ->
                val status = when (val check = s.check) {
                    ServerUrlCheck.Allowed -> if (s.inUse) UiText.of(R.string.server_in_use) else UiText.of(R.string.server_allowed)
                    ServerUrlCheck.Malformed -> UiText.of(R.string.server_malformed)
                    is ServerUrlCheck.CleartextBlocked -> UiText.of(R.string.server_cleartext_blocked, check.host)
                }
                SettingRow(UiText.Literal(s.url), null, supporting = status)
            }
        }
        SettingsGroup(UiText.of(R.string.group_security), Accent) {
            SettingRow(UiText.of(R.string.security_change_pin), null, onClick = a.openPin)
        }
        Spacer(Modifier.height(8.dp))
    }

    c.edit?.let { EditDialogFor(it, c, a) }
    c.pin?.let { PinDialog(it, a.changePin, a.closePin) }
}

@Composable
private fun syncLabel(minutes: Int): UiText = if (minutes == 0) UiText.of(R.string.sync_off) else UiText.of(R.string.sync_every_minutes, minutes)

@Composable
private fun EditDialogFor(edit: EditState, c: SettingsContent, a: SettingsActions) {
    val key = edit.key
    when {
        key == SettingKey.AiProvider.key -> ChoiceDialog(
            UiText.of(R.string.setting_ai_provider),
            SettingsValidation.AiProviders.map { it to UiText.Literal(it) },
            c.values[key], edit.error, onChoose = { a.save(key, it) }, onDismiss = a.cancelEdit,
        )
        key == SettingKey.GarminSyncMinutes.key -> ChoiceDialog(
            UiText.of(R.string.setting_garmin_sync),
            SyncChoices.map { it.toString() to syncLabel(it) },
            c.values[key], edit.error, onChoose = { a.save(key, it) }, onDismiss = a.cancelEdit,
        )
        key == TREND_KEY -> ChoiceDialog(
            UiText.of(R.string.target_trend_window),
            Targets.TrendDayOptions.map { it.toString() to io.github.bridgemouse.bacta.ui.metrics.periodOf(it) },
            c.targets.trendDays.toString(), null, onChoose = { a.setTrendDays(it.toInt()); a.cancelEdit() }, onDismiss = a.cancelEdit,
        )
        key == SettingKey.NightlyTime.key -> TimeDialog(UiText.of(R.string.setting_nightly_time), c.values[key].orEmpty(), edit.error, onConfirm = { a.save(key, it) }, onDismiss = a.cancelEdit)
        key in TargetField.entries.map { it.name } -> {
            val field = TargetField.valueOf(key)
            val title = when (field) {
                TargetField.SleepMinutes -> R.string.target_sleep
                TargetField.WeeklyIntensity -> R.string.target_intensity
                TargetField.CaloriesTotal -> R.string.target_calories_total
                TargetField.CaloriesActive -> R.string.target_calories_active
            }
            val unit = if (field == TargetField.SleepMinutes || field == TargetField.WeeklyIntensity) R.string.unit_min else R.string.unit_kcal
            TextEditDialog(UiText.of(title), edit, numeric = true, secret = false, hint = UiText.of(unit), onSave = { a.setTarget(field, it) }, onDismiss = a.cancelEdit)
        }
        else -> {
            val setting = SettingKey.All.firstOrNull { it.key == key }
            val title = when (key) {
                SettingKey.AiApiKey.key -> R.string.setting_ai_api_key
                SettingKey.BriefingModel.key -> R.string.setting_briefing_model
                else -> R.string.setting_chat_model
            }
            TextEditDialog(
                UiText.of(title), edit, numeric = false, secret = setting?.secret == true,
                hint = if (setting?.secret == true) UiText.of(R.string.setting_api_key_hint) else null,
                onSave = { a.save(key, it) }, onDismiss = a.cancelEdit,
            )
        }
    }
}
