package io.github.bridgemouse.bacta.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.AuthRepository
import io.github.bridgemouse.bacta.data.repository.AuthStatus
import io.github.bridgemouse.bacta.data.repository.Compatibility
import io.github.bridgemouse.bacta.data.repository.ServerRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** `start == null` while the first check is running. */
data class StartUiState(val start: StartDestination? = null, val sessionExpired: Boolean = false) {
    val loginRequired: Boolean get() = start == StartDestination.Login || sessionExpired
}

@HiltViewModel
class StartViewModel @Inject constructor(
    private val server: ServerRepository,
    private val auth: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(StartUiState())
    val state: StateFlow<StartUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            auth.sessionExpired.collect { _state.update { it.copy(sessionExpired = true) } }
        }
    }

    fun resolve(permission: PermissionState, appVersion: String) {
        _state.update { it.copy(start = null) }
        viewModelScope.launch {
            val granted = permission == PermissionState.Granted
            val compat = if (granted) server.compatibility(appVersion) else Compatibility.Unreachable
            val status = if (compat is Compatibility.Ok) auth.status() else Result.failure<AuthStatus>(IllegalStateException("server not usable"))
            val start = resolveStart(permission, compat, status)
            _state.update { it.copy(start = start, sessionExpired = false) }
        }
    }

    fun onLoggedIn() {
        _state.update { StartUiState(start = StartDestination.Home, sessionExpired = false) }
    }
}
