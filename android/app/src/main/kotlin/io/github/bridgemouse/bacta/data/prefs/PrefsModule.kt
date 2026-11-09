package io.github.bridgemouse.bacta.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.preferencesDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** One DataStore instance per file, via the delegate (DataStore docs); a corrupt file falls back to defaults because these are non-critical preferences. */
private val Context.targetsDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "targets",
    corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
)

private val Context.uiDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "ui_prefs",
    corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
)

@Module
@InstallIn(SingletonComponent::class)
object PrefsModule {
    @Provides @Singleton
    fun targetsRepository(@ApplicationContext context: Context): TargetsRepository =
        DataStoreTargetsRepository(context.targetsDataStore)

    @Provides @Singleton
    fun uiPreferencesRepository(@ApplicationContext context: Context): UiPreferencesRepository =
        DataStoreUiPreferencesRepository(context.uiDataStore)
}
