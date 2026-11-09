package io.github.bridgemouse.bacta.data.prefs

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import app.cash.turbine.test
import java.io.File
import kotlin.test.assertEquals
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class UiPreferencesRepositoryTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun TestScope.repo(file: File = tmp.newFile("u.preferences_pb").also { it.delete() }) =
        DataStoreUiPreferencesRepository(PreferenceDataStoreFactory.create(scope = backgroundScope) { file })

    @Test
    fun hintsAreOnUntilTheUserTurnsThemOff() = runTest(UnconfinedTestDispatcher()) {
        assertEquals(true, repo().showInfoHints.first())
    }

    @Test
    fun theChoicePersistsAndEmits() = runTest(UnconfinedTestDispatcher()) {
        val r = repo()
        r.showInfoHints.test {
            assertEquals(true, awaitItem())
            r.setShowInfoHints(false)
            assertEquals(false, awaitItem())
            r.setShowInfoHints(true)
            assertEquals(true, awaitItem())
        }
    }
}
