package io.github.bridgemouse.bacta.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.network.ServerConfig
import io.github.bridgemouse.bacta.data.prefs.TargetsRepository
import io.github.bridgemouse.bacta.data.repository.PinChangeResult
import io.github.bridgemouse.bacta.data.repository.SaveResult
import io.github.bridgemouse.bacta.data.repository.SettingsRepository
import io.github.bridgemouse.bacta.domain.ServerUrlPolicy
import io.github.bridgemouse.bacta.domain.SettingKey
import io.github.bridgemouse.bacta.domain.SettingsValidation
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.ui.UiText
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settings: SettingsRepository,
    private val targets: TargetsRepository,
    private val servers: ServerConfig,
    private val uiPrefs: io.github.bridgemouse.bacta.data.prefs.UiPreferencesRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    init {
        refresh()
        // Targets are shared with the Sleep and Training screens, so the settings view follows the one stored copy.
        viewModelScope.launch { targets.targets.collect { t -> edit { it.copy(targets = t) } } }
        viewModelScope.launch { uiPrefs.showInfoHints.collect { on -> edit { it.copy(infoHints = on) } } }
    }

    fun refresh() {
        _state.value = SettingsUiState.Loading
        viewModelScope.launch {
            val values = settings.load().getOrNull()
            val models = settings.models().getOrNull().orEmpty()
            _state.value = if (values == null) SettingsUiState.Error else SettingsUiState.Content(
                SettingsContent(values = values, targets = targets.targets.first(), servers = serverRows(), models = models),
            )
        }
    }

    private fun serverRows() = servers.candidates.map {
        io.github.bridgemouse.bacta.ui.settings.ServerRowModel(it.toString(), it == servers.current, ServerUrlPolicy.check(it.toString(), ServerConfig.CLEARTEXT_HOSTS))
    }

    private fun edit(transform: (SettingsContent) -> SettingsContent) =
        _state.update { if (it is SettingsUiState.Content) SettingsUiState.Content(transform(it.content)) else it }

    private fun current(): SettingsContent? = (_state.value as? SettingsUiState.Content)?.content

    fun startEdit(key: String) = edit { c ->
        val initial = when {
            SettingKey.All.firstOrNull { it.key == key }?.secret == true -> ""
            key in TargetField.entries.map { it.name } -> TargetField.valueOf(key).read(c.targets)?.toString().orEmpty()
            else -> c.values[key].orEmpty()
        }
        c.copy(edit = EditState(key, initial))
    }

    fun chooseCustomModel() = edit { c ->
        c.copy(edit = c.edit?.copy(custom = true, initial = c.values[c.edit.key].orEmpty()))
    }

    fun cancelEdit() = edit { it.copy(edit = null) }

    fun dismissMessage() = edit { it.copy(message = null) }

    fun save(key: String, value: String) {
        if (!SettingsValidation.validate(key, value)) {
            edit { fail(it, key, UiText.of(R.string.error_invalid)) }
            return
        }
        edit { it.copy(saving = it.saving + key, edit = it.edit?.takeIf { e -> e.key == key }?.copy(error = null, saving = true) ?: it.edit) }
        viewModelScope.launch {
            val result = settings.save(key, value)
            if (result == SaveResult.Saved && key == SettingKey.AiProvider.key) resetModelsFor(value)
            edit { c ->
                val done = c.copy(saving = c.saving - key)
                when (result) {
                    SaveResult.Saved -> done.copy(values = done.values + (key to storedForm(key, value)), edit = done.edit?.takeIf { it.key != key })
                    SaveResult.Unchanged -> done.copy(edit = done.edit?.takeIf { it.key != key })
                    SaveResult.Invalid -> fail(done, key, UiText.of(R.string.error_invalid))
                    is SaveResult.Rejected -> fail(done, key, UiText.Literal(result.message))
                    SaveResult.Failure -> fail(done, key, UiText.of(R.string.error_save_failed))
                }
            }
        }
    }

    /** A model id from one provider is meaningless to another, so choosing a provider also selects that provider's first listed model. */
    private fun resetModelsFor(provider: String) {
        val first = current()?.models?.get(provider)?.firstOrNull() ?: return
        save(SettingKey.BriefingModel.key, first)
        save(SettingKey.ChatModel.key, first)
    }

    /** A secret is shown the way the server returns it, masked, never as typed. */
    private fun storedForm(key: String, value: String): String =
        if (SettingKey.All.firstOrNull { it.key == key }?.secret == true) SettingsValidation.MASK.toString().repeat(4) + value.takeLast(4) else value

    private fun fail(c: SettingsContent, key: String, message: UiText): SettingsContent =
        if (c.edit?.key == key) c.copy(edit = c.edit.copy(error = message, saving = false)) else c.copy(message = message)

    fun setTarget(field: TargetField, text: String) {
        val trimmed = text.trim()
        val parsed: Int? = if (trimmed.isEmpty() && field.optional) null else trimmed.toIntOrNull()
        val invalid = (parsed == null && !(trimmed.isEmpty() && field.optional))
        viewModelScope.launch {
            val candidate = field.write(targets.targets.first(), parsed)
            if (invalid || candidate.sanitized() != candidate) {
                edit { c -> c.copy(edit = c.edit?.copy(error = UiText.of(R.string.error_invalid))) }
                return@launch
            }
            targets.update { field.write(it, parsed) }
            edit { it.copy(edit = null) }
        }
    }

    fun setTrendDays(days: Int) {
        if (days !in Targets.TrendDayOptions) return
        viewModelScope.launch { targets.update { it.copy(trendDays = days) } }
    }

    fun testConnection() {
        edit { it.copy(connection = ConnectionState.Testing) }
        viewModelScope.launch {
            val result = settings.testConnection().getOrNull()
            edit { it.copy(connection = if (result == null) ConnectionState.Failed(null) else if (result.ok) ConnectionState.Ok else ConnectionState.Failed(result.error)) }
        }
    }

    fun setInfoHints(show: Boolean) {
        viewModelScope.launch { uiPrefs.setShowInfoHints(show) }
    }

    fun openPin() = edit { it.copy(pin = PinState()) }

    fun closePin() = edit { it.copy(pin = null) }

    fun changePin(current: String, new: String) {
        edit { it.copy(pin = PinState(saving = true)) }
        viewModelScope.launch {
            val result = settings.changePin(current, new)
            edit {
                if (result == PinChangeResult.Success) it.copy(pin = null, message = UiText.of(R.string.pin_changed))
                else it.copy(pin = PinState(error = result))
            }
        }
    }
}
