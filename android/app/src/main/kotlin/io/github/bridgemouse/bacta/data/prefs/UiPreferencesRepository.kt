package io.github.bridgemouse.bacta.data.prefs

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** How the app looks, as chosen by the user. Hints are on by default so a new user can find the card explanations. */
interface UiPreferencesRepository {
    val showInfoHints: Flow<Boolean>
    suspend fun setShowInfoHints(show: Boolean)
}

class DataStoreUiPreferencesRepository(private val store: DataStore<Preferences>) : UiPreferencesRepository {
    private val hints = booleanPreferencesKey("info_hints")

    override val showInfoHints: Flow<Boolean> = store.data.map { it[hints] ?: true }

    override suspend fun setShowInfoHints(show: Boolean) {
        store.edit { it[hints] = show }
    }
}
