package io.github.bridgemouse.bacta.ui.about

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.repository.ServerRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** [serverVersion] is null while loading and when the server could not be reached. */
data class AboutUiState(val loaded: Boolean = false, val serverVersion: String? = null)

@HiltViewModel
class AboutViewModel @Inject constructor(private val server: ServerRepository) : ViewModel() {
    private val _state = MutableStateFlow(AboutUiState())
    val state: StateFlow<AboutUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch { _state.value = AboutUiState(loaded = true, serverVersion = server.serverVersion().getOrNull()) }
    }
}
