package io.github.bridgemouse.bacta.data.prefs

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import io.github.bridgemouse.bacta.domain.Targets
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

interface TargetsRepository {
    val targets: Flow<Targets>
    suspend fun update(transform: (Targets) -> Targets)
}

class DataStoreTargetsRepository(private val store: DataStore<Preferences>) : TargetsRepository {
    private val sleep = intPreferencesKey("sleep_minutes")
    private val intensity = intPreferencesKey("weekly_intensity_minutes")
    private val distance = intPreferencesKey("distance_goal_m")
    private val caloriesTotal = intPreferencesKey("calories_total_goal")
    private val caloriesActive = intPreferencesKey("calories_active_goal")
    private val trendDays = intPreferencesKey("trend_days")

    override val targets: Flow<Targets> = store.data.map { p ->
        Targets(
            sleepMinutes = p[sleep] ?: Targets.Default.sleepMinutes,
            weeklyIntensityMinutes = p[intensity] ?: Targets.Default.weeklyIntensityMinutes,
            distanceMeters = p[distance],
            caloriesTotal = p[caloriesTotal],
            caloriesActive = p[caloriesActive],
            trendDays = p[trendDays] ?: Targets.Default.trendDays,
        ).sanitized()
    }

    override suspend fun update(transform: (Targets) -> Targets) {
        val next = transform(targets.first()).sanitized()
        store.edit { p ->
            p[sleep] = next.sleepMinutes
            p[intensity] = next.weeklyIntensityMinutes
            p[trendDays] = next.trendDays
            next.distanceMeters?.let { p[distance] = it } ?: p.remove(distance)
            next.caloriesTotal?.let { p[caloriesTotal] = it } ?: p.remove(caloriesTotal)
            next.caloriesActive?.let { p[caloriesActive] = it } ?: p.remove(caloriesActive)
        }
    }
}
