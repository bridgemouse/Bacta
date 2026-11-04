package io.github.bridgemouse.bacta.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.AuthRepository
import io.github.bridgemouse.bacta.data.repository.LoginResult
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class LoginViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onPinChanged(raw: String) {
        val clean = sanitizePin(raw)
        _state.update { if (it.pin == clean) it else it.copy(pin = clean, error = null) }
    }

    fun onSubmit() {
        val pin = _state.value.pin
        if (!_state.value.canSubmit) return
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (auth.login(pin)) {
                LoginResult.Success -> _state.update { it.copy(busy = false, done = true) }
                LoginResult.WrongPin -> _state.update { it.copy(busy = false, pin = "", error = LoginError.WrongPin) }
                LoginResult.Failure -> _state.update { it.copy(busy = false, error = LoginError.Connection) }
            }
        }
    }
}
