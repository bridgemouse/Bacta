package io.github.bridgemouse.bacta.data.prefs

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import app.cash.turbine.test
import io.github.bridgemouse.bacta.domain.Targets
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class TargetsRepositoryTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun TestScope.repo(file: File = tmp.newFile("t.preferences_pb").also { it.delete() }) =
        DataStoreTargetsRepository(PreferenceDataStoreFactory.create(scope = backgroundScope) { file })

    @Test
    fun emitsDefaultsBeforeAnythingIsSaved() = runTest(UnconfinedTestDispatcher()) {
        assertEquals(Targets.Default, repo().targets.first())
    }

    @Test
    fun targetsPersistAndEmit() = runTest(UnconfinedTestDispatcher()) {
        val r = repo()
        r.targets.test {
            assertEquals(Targets.Default, awaitItem())
            r.update { it.copy(sleepMinutes = 450, distanceMeters = 8000, trendDays = 14) }
            val saved = awaitItem()
            assertEquals(450, saved.sleepMinutes)
            assertEquals(8000, saved.distanceMeters)
            assertEquals(14, saved.trendDays)
        }
    }

    @Test
    fun invalidUpdatesAreSanitizedBeforeTheyAreStored() = runTest(UnconfinedTestDispatcher()) {
        val r = repo()
        r.update { it.copy(sleepMinutes = -1, trendDays = 99) }
        val now = r.targets.first()
        assertEquals(Targets.Default.sleepMinutes, now.sleepMinutes)
        assertEquals(Targets.Default.trendDays, now.trendDays)
    }

    @Test
    fun clearingAnOptionalGoalRemovesIt() = runTest(UnconfinedTestDispatcher()) {
        val r = repo()
        r.update { it.copy(caloriesTotal = 2500) }
        assertEquals(2500, r.targets.first().caloriesTotal)
        r.update { it.copy(caloriesTotal = null) }
        assertNull(r.targets.first().caloriesTotal)
    }

    @Test
    fun valuesSurviveRecreatingTheStore() = runTest(UnconfinedTestDispatcher()) {
        val file = tmp.newFile("shared.preferences_pb").also { it.delete() }
        // DataStore allows one live instance per file, so the first store is closed before the file is reopened.
        val firstScope = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + Job())
        DataStoreTargetsRepository(PreferenceDataStoreFactory.create(scope = firstScope) { file })
            .update { it.copy(weeklyIntensityMinutes = 210) }
        firstScope.coroutineContext[Job]!!.cancelAndJoin()

        val second = DataStoreTargetsRepository(PreferenceDataStoreFactory.create(scope = backgroundScope) { file })
        assertEquals(210, second.targets.first().weeklyIntensityMinutes)
    }
}
