package io.github.bridgemouse.bacta.ui.settings

import io.github.bridgemouse.bacta.data.network.ServerConfig
import io.github.bridgemouse.bacta.data.prefs.TargetsRepository
import io.github.bridgemouse.bacta.data.repository.ConnectionTest
import io.github.bridgemouse.bacta.data.repository.LogEntry
import io.github.bridgemouse.bacta.data.repository.PinChangeResult
import io.github.bridgemouse.bacta.data.repository.SaveResult
import io.github.bridgemouse.bacta.data.repository.SettingsRepository
import io.github.bridgemouse.bacta.domain.ServerUrlCheck
import io.github.bridgemouse.bacta.domain.SettingsValidation
import io.github.bridgemouse.bacta.domain.Targets
import io.github.bridgemouse.bacta.s
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeSettings : SettingsRepository {
    var loadHandler: suspend () -> Result<Map<String, String>> = {
        Result.success(
            mapOf(
                "ai_provider" to "google", "ai_api_key" to "••••abcd", "mx4_briefing_model" to "model-a", "mx4_chat_model" to "model-b",
                "mx4_nightly_enabled" to "false", "mx4_nightly_time" to "03:00", "mx4_on_sync_enabled" to "false", "garmin_background_sync_min" to "0",
            ),
        )
    }
    val puts = mutableListOf<Pair<String, String>>()
    var saveHandler: suspend (String, String) -> SaveResult = { k, v -> puts += k to v; SaveResult.Saved }
    var pinHandler: suspend (String, String) -> PinChangeResult = { _, _ -> PinChangeResult.Success }
    var connectionHandler: suspend () -> Result<ConnectionTest> = { Result.success(ConnectionTest(true, null)) }
    var modelsHandler: suspend () -> Result<Map<String, List<String>>> = { Result.success(mapOf("google" to listOf("gemini-new", "gemini-alt"), "anthropic" to listOf("claude-new"))) }
    override suspend fun models() = modelsHandler()
    override suspend fun load() = loadHandler()
    override suspend fun save(key: String, value: String) = saveHandler(key, value)
    override suspend fun testConnection() = connectionHandler()
    override suspend fun changePin(current: String, new: String) = pinHandler(current, new)
    override suspend fun logs(source: String?, limit: Int): Result<List<LogEntry>> = Result.success(emptyList())
    override suspend fun logSources(): Result<List<String>> = Result.success(emptyList())
}

private class FakeUiPrefs : io.github.bridgemouse.bacta.data.prefs.UiPreferencesRepository {
    val flow = MutableStateFlow(true)
    override val showInfoHints: Flow<Boolean> = flow
    override suspend fun setShowInfoHints(show: Boolean) { flow.value = show }
}

private class FakeTargets : TargetsRepository {
    val flow = MutableStateFlow(Targets.Default)
    override val targets: Flow<Targets> = flow
    override suspend fun update(transform: (Targets) -> Targets) { flow.value = transform(flow.value).sanitized() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    private val settings = FakeSettings()
    private val targets = FakeTargets()
    private val uiPrefs = FakeUiPrefs()
    private val config = ServerConfig(listOf("http://bacta.home/".toHttpUrl(), "http://example.org/".toHttpUrl()))

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = SettingsViewModel(settings, targets, config, uiPrefs)
    private fun SettingsViewModel.content() = assertIs<SettingsUiState.Content>(state.value).content

    @Test
    fun loadsValuesTargetsAndServers() = runTest {
        val c = vm().content()
        assertEquals("03:00", c.values.getValue("mx4_nightly_time"))
        assertEquals(Targets.Default, c.targets)
        assertEquals(2, c.servers.size)
    }

    @Test
    fun aFailedLoadIsAnErrorAndRefreshRecovers() = runTest {
        settings.loadHandler = { Result.failure(IOException("x")) }
        val vm = vm()
        assertEquals(SettingsUiState.Error, vm.state.value)
        settings.loadHandler = { Result.success(emptyMap()) }
        vm.refresh()
        assertIs<SettingsUiState.Content>(vm.state.value)
    }

    @Test
    fun editValidatesBeforeSaving() = runTest {
        val vm = vm()
        vm.startEdit("mx4_nightly_time")
        vm.save("mx4_nightly_time", "25:00")
        val edit = assertNotNull(vm.content().edit)
        assertNotNull(edit.error)
        assertEquals(emptyList(), settings.puts)
    }

    @Test
    fun savingOneKeyDoesNotTouchOthers() = runTest {
        val vm = vm()
        val before = vm.content().values
        vm.startEdit("mx4_chat_model")
        vm.save("mx4_chat_model", "model-c")
        val c = vm.content()
        assertEquals(listOf("mx4_chat_model" to "model-c"), settings.puts)
        assertEquals("model-c", c.values.getValue("mx4_chat_model"))
        assertEquals(before - "mx4_chat_model", c.values - "mx4_chat_model")
        assertNull(c.edit)
    }

    @Test
    fun saveFailureKeepsTheEditAndShowsTheError() = runTest {
        val vm = vm()
        vm.startEdit("mx4_chat_model")
        settings.saveHandler = { _, _ -> SaveResult.Failure }
        vm.save("mx4_chat_model", "model-c")
        val c = vm.content()
        assertEquals("mx4_chat_model", c.edit?.key)
        assertNotNull(c.edit?.error)
        assertEquals("model-b", c.values.getValue("mx4_chat_model"))
        settings.saveHandler = { _, _ -> SaveResult.Rejected("invalid value for mx4_chat_model") }
        vm.save("mx4_chat_model", "model-c")
        assertEquals("invalid value for mx4_chat_model", vm.content().edit?.error.s())
    }

    @Test
    fun aToggleFailureShowsAMessageAndKeepsTheOldValue() = runTest {
        settings.saveHandler = { _, _ -> SaveResult.Failure }
        val vm = vm()
        vm.save("mx4_nightly_enabled", "true")
        assertEquals("false", vm.content().values.getValue("mx4_nightly_enabled"))
        assertNotNull(vm.content().message)
        vm.dismissMessage()
        assertNull(vm.content().message)
    }

    @Test
    fun secretFieldStartsEmptyAndSavesOnlyWhenTyped() = runTest {
        val vm = vm()
        assertTrue(SettingsValidation.isMasked(vm.content().values.getValue("ai_api_key")))
        vm.startEdit("ai_api_key")
        assertEquals("", vm.content().edit?.initial)
        settings.saveHandler = { _, _ -> SaveResult.Unchanged }
        vm.save("ai_api_key", "")
        assertNull(vm.content().edit)
        assertEquals("••••abcd", vm.content().values.getValue("ai_api_key"))
        vm.startEdit("ai_api_key")
        settings.saveHandler = { k, v -> settings.puts += k to v; SaveResult.Saved }
        vm.save("ai_api_key", "sk-new")
        assertEquals(listOf("ai_api_key" to "sk-new"), settings.puts)
        assertTrue(SettingsValidation.isMasked(vm.content().values.getValue("ai_api_key")))
        assertFalse(vm.content().values.getValue("ai_api_key").contains("sk-new"))
    }

    @Test
    fun changingATargetUpdatesTheScreensThatUseIt() = runTest {
        val vm = vm()
        vm.startEdit(TargetField.WeeklyIntensity.name)
        vm.setTarget(TargetField.WeeklyIntensity, "200")
        assertEquals(200, targets.flow.value.weeklyIntensityMinutes)
        assertEquals(200, vm.content().targets.weeklyIntensityMinutes)
        assertNull(vm.content().edit)
    }

    @Test
    fun anOutOfRangeTargetIsRefusedAndNothingChanges() = runTest {
        val vm = vm()
        vm.startEdit(TargetField.WeeklyIntensity.name)
        vm.setTarget(TargetField.WeeklyIntensity, "5")
        assertNotNull(vm.content().edit?.error)
        assertEquals(150, targets.flow.value.weeklyIntensityMinutes)
        vm.setTarget(TargetField.WeeklyIntensity, "abc")
        assertNotNull(vm.content().edit?.error)
    }

    @Test
    fun anOptionalGoalCanBeClearedAndTheTrendWindowChosen() = runTest {
        val vm = vm()
        vm.setTarget(TargetField.CaloriesTotal, "2500")
        assertEquals(2500, targets.flow.value.caloriesTotal)
        vm.setTarget(TargetField.CaloriesTotal, "")
        assertNull(targets.flow.value.caloriesTotal)
        vm.setTrendDays(14)
        assertEquals(14, targets.flow.value.trendDays)
        vm.setTrendDays(9)
        assertEquals(14, targets.flow.value.trendDays)
    }

    @Test
    fun changePinReportsEachOutcome() = runTest {
        val vm = vm()
        vm.openPin()
        settings.pinHandler = { _, _ -> PinChangeResult.WrongCurrent }
        vm.changePin("0000", "5678")
        assertEquals(PinChangeResult.WrongCurrent, vm.content().pin?.error)
        settings.pinHandler = { _, _ -> PinChangeResult.Success }
        vm.changePin("1234", "5678")
        assertNull(vm.content().pin)
        assertNotNull(vm.content().message)
    }

    @Test
    fun testConnectionShowsTheServersAnswer() = runTest {
        val vm = vm()
        settings.connectionHandler = { Result.success(ConnectionTest(false, "no key")) }
        vm.testConnection()
        assertEquals(ConnectionState.Failed("no key"), vm.content().connection)
        settings.connectionHandler = { Result.success(ConnectionTest(true, null)) }
        vm.testConnection()
        assertEquals(ConnectionState.Ok, vm.content().connection)
        settings.connectionHandler = { Result.failure(IOException("x")) }
        vm.testConnection()
        assertEquals(ConnectionState.Failed(null), vm.content().connection)
    }

    @Test
    fun serversShowWhichIsInUseAndFlagACleartextHostThatIsNotAllowed() = runTest {
        val servers = vm().content().servers
        assertEquals(listOf(true, false), servers.map { it.inUse })
        assertEquals(ServerUrlCheck.Allowed, servers[0].check)
        assertEquals(ServerUrlCheck.CleartextBlocked("example.org"), servers[1].check)
    }

    @Test
    fun savingMarksTheKeyInFlight() = runTest {
        val gate = CompletableDeferred<SaveResult>()
        settings.saveHandler = { _, _ -> gate.await() }
        val vm = vm()
        vm.save("mx4_nightly_enabled", "true")
        assertTrue("mx4_nightly_enabled" in vm.content().saving)
        gate.complete(SaveResult.Saved)
        assertTrue(vm.content().saving.isEmpty())
        assertEquals("true", vm.content().values.getValue("mx4_nightly_enabled"))
    }

    @Test
    fun modelChoicesComeFromTheServerForTheCurrentProviderAndKeepAnUnlistedCurrentModel() = runTest {
        val c = vm().content()
        // the loaded briefing model is "model-a", which the server no longer lists
        assertEquals(listOf("model-a", "gemini-new", "gemini-alt"), c.modelChoices("mx4_briefing_model"))
    }

    @Test
    fun anUnreachableModelListLeavesOnlyTheCurrentModelToChooseFrom() = runTest {
        settings.modelsHandler = { Result.failure(IOException("x")) }
        assertEquals(listOf("model-a"), vm().content().modelChoices("mx4_briefing_model"))
    }

    @Test
    fun changingTheProviderResetsBothModelsToTheFirstOfTheNewProvider() = runTest {
        val vm = vm()
        vm.startEdit("ai_provider")
        vm.save("ai_provider", "anthropic")
        assertEquals(
            listOf("ai_provider" to "anthropic", "mx4_briefing_model" to "claude-new", "mx4_chat_model" to "claude-new"),
            settings.puts,
        )
        assertEquals("claude-new", vm.content().values.getValue("mx4_chat_model"))
    }

    @Test
    fun aCustomModelOpensTheTextEntryForThatKey() = runTest {
        val vm = vm()
        vm.startEdit("mx4_chat_model")
        assertEquals(false, vm.content().edit?.custom)
        vm.chooseCustomModel()
        assertEquals(true, vm.content().edit?.custom)
        assertEquals("model-b", vm.content().edit?.initial)
    }

    @Test
    fun theCardHintSettingStartsOnAndTheToggleIsPersisted() = runTest {
        val vm = vm()
        assertEquals(true, vm.content().infoHints)
        vm.setInfoHints(false)
        assertEquals(false, uiPrefs.flow.value)
        assertEquals(false, vm.content().infoHints)
    }
}
