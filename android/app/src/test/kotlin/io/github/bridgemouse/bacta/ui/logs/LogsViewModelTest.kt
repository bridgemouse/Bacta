package io.github.bridgemouse.bacta.ui.logs

import io.github.bridgemouse.bacta.data.repository.ConnectionTest
import io.github.bridgemouse.bacta.data.repository.LogEntry
import io.github.bridgemouse.bacta.data.repository.PinChangeResult
import io.github.bridgemouse.bacta.data.repository.SaveResult
import io.github.bridgemouse.bacta.data.repository.SettingsRepository
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeLogs : SettingsRepository {
    var sources: Result<List<String>> = Result.success(listOf("garmin", "mx4"))
    var asked = mutableListOf<Pair<String?, Int>>()
    var logsHandler: (String?) -> Result<List<LogEntry>> = { s -> Result.success(listOf(LogEntry(s ?: "garmin", "info", "synthetic", java.time.Instant.parse("2026-11-04T03:00:00Z")))) }
    override suspend fun load() = Result.success(emptyMap<String, String>())
    override suspend fun save(key: String, value: String) = SaveResult.Saved
    override suspend fun testConnection() = Result.success(ConnectionTest(true, null))
    override suspend fun changePin(current: String, new: String) = PinChangeResult.Success
    override suspend fun logs(source: String?, limit: Int): Result<List<LogEntry>> { asked += source to limit; return logsHandler(source) }
    override suspend fun logSources() = sources
}

@OptIn(ExperimentalCoroutinesApi::class)
class LogsViewModelTest {
    private val repo = FakeLogs()
    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun loadsSourcesAndTheNewestEntriesUnfiltered() = runTest {
        val vm = LogsViewModel(repo)
        val c = assertIs<LogsUiState.Content>(vm.state.value)
        assertEquals(listOf("garmin", "mx4"), c.sources)
        assertEquals(null, c.selected)
        assertEquals(1, c.entries.size)
        assertEquals(null to LogsViewModel.PAGE, repo.asked.first())
    }

    @Test
    fun selectingASourceFiltersAndSelectingItAgainClearsIt() = runTest {
        val vm = LogsViewModel(repo)
        vm.select("mx4")
        assertEquals("mx4", assertIs<LogsUiState.Content>(vm.state.value).selected)
        assertEquals("mx4" to LogsViewModel.PAGE, repo.asked.last())
        vm.select("mx4")
        assertEquals(null, assertIs<LogsUiState.Content>(vm.state.value).selected)
    }

    @Test
    fun aFailedSourceListStillShowsEntries() = runTest {
        repo.sources = Result.failure(IOException("x"))
        val c = assertIs<LogsUiState.Content>(LogsViewModel(repo).state.value)
        assertEquals(emptyList(), c.sources)
        assertEquals(1, c.entries.size)
    }

    @Test
    fun aFailedEntryLoadIsAnErrorAndRefreshRecovers() = runTest {
        repo.logsHandler = { Result.failure(IOException("x")) }
        val vm = LogsViewModel(repo)
        assertEquals(LogsUiState.Error, vm.state.value)
        repo.logsHandler = { Result.success(emptyList()) }
        vm.refresh()
        assertIs<LogsUiState.Content>(vm.state.value)
    }
}
