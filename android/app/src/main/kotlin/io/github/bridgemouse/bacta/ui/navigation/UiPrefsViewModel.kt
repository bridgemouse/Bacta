package io.github.bridgemouse.bacta.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.bridgemouse.bacta.data.prefs.UiPreferencesRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class UiPrefsViewModel @Inject constructor(prefs: UiPreferencesRepository) : ViewModel() {
    val showInfoHints: StateFlow<Boolean> = prefs.showInfoHints.stateIn(viewModelScope, SharingStarted.Eagerly, true)
}
