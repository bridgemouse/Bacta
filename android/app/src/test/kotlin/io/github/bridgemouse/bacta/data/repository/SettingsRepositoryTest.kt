package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.LogDto
import io.github.bridgemouse.bacta.data.network.LogSourcesDto
import io.github.bridgemouse.bacta.data.network.LogsDto
import io.github.bridgemouse.bacta.data.network.OkDto
import io.github.bridgemouse.bacta.data.network.TestConnectionDto
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test
import retrofit2.Response

class SettingsRepositoryTest {
    private val api = FakeBactaApi()
    private val repo = DefaultSettingsRepository(api)
    private val puts = mutableListOf<Pair<String, String>>()

    init {
        api.putSettingHandler = { k, v -> puts += k to v; Response.success(OkDto(true)) }
    }

    private fun failure(code: Int, body: String) = Response.error<OkDto>(code, body.toResponseBody("application/json".toMediaType()))

    @Test
    fun loadKeepsOnlyTheInUseKeys() = runTest {
        api.settingsHandler = { mapOf("ai_provider" to "google", "mx4_chat_model" to "m", "strava_client_secret" to "••••zzzz", "base_url" to "") }
        val s = repo.load().getOrThrow()
        assertEquals(setOf("ai_provider", "mx4_chat_model"), s.keys)
    }

    @Test
    fun secretValuesAreMaskedAndNeverWrittenBack() = runTest {
        api.settingsHandler = { mapOf("ai_api_key" to "••••abcd") }
        assertEquals("••••abcd", repo.load().getOrThrow().getValue("ai_api_key"))
        assertEquals(SaveResult.Unchanged, repo.save("ai_api_key", "••••abcd"))
        assertEquals(SaveResult.Unchanged, repo.save("ai_api_key", ""))
        assertEquals(emptyList(), puts)
        assertEquals(SaveResult.Saved, repo.save("ai_api_key", "sk-new"))
        assertEquals(listOf("ai_api_key" to "sk-new"), puts)
    }

    @Test
    fun anInvalidValueIsRefusedWithoutARequest() = runTest {
        assertEquals(SaveResult.Invalid, repo.save("mx4_nightly_time", "25:00"))
        assertEquals(SaveResult.Invalid, repo.save("not_a_key", "x"))
        assertEquals(emptyList(), puts)
    }

    @Test
    fun savingOneKeySendsOnlyThatKey() = runTest {
        assertEquals(SaveResult.Saved, repo.save("mx4_nightly_enabled", "true"))
        assertEquals(listOf("mx4_nightly_enabled" to "true"), puts)
    }

    @Test
    fun serverRejectionBecomesAValidationError() = runTest {
        api.putSettingHandler = { _, _ -> failure(400, """{"error":"invalid value for ai_provider"}""") }
        val r = repo.save("ai_provider", "google")
        assertEquals(SaveResult.Rejected("invalid value for ai_provider"), r)
    }

    @Test
    fun aNetworkFailureIsAFailureNotARejection() = runTest {
        api.putSettingHandler = { _, _ -> throw IOException("down") }
        assertEquals(SaveResult.Failure, repo.save("ai_provider", "google"))
    }

    @Test
    fun pinChangeMapsWrongCurrentPinAndFormatErrors() = runTest {
        api.setPinHandler = { Response.success(OkDto(true)) }
        assertEquals(PinChangeResult.Success, repo.changePin("1234", "5678"))
        api.setPinHandler = { failure(401, """{"ok":false,"error":"Current PIN incorrect"}""") }
        assertEquals(PinChangeResult.WrongCurrent, repo.changePin("0000", "5678"))
        api.setPinHandler = { failure(400, """{"ok":false,"error":"PIN must be 4–12 digits"}""") }
        assertEquals(PinChangeResult.BadFormat, repo.changePin("1234", "5678"))
        api.setPinHandler = { throw IOException("down") }
        assertEquals(PinChangeResult.Failure, repo.changePin("1234", "5678"))
    }

    @Test
    fun aMalformedNewPinNeverLeavesTheDevice() = runTest {
        var called = false
        api.setPinHandler = { called = true; Response.success(OkDto(true)) }
        assertEquals(PinChangeResult.BadFormat, repo.changePin("1234", "12"))
        assertEquals(false, called)
    }

    @Test
    fun testConnectionReturnsTheServersAnswer() = runTest {
        api.testConnectionHandler = { TestConnectionDto(ok = false, error = "no key") }
        val r = repo.testConnection().getOrThrow()
        assertEquals(false, r.ok); assertEquals("no key", r.error)
    }

    @Test
    fun logsDecodeAndRespectLimit() = runTest {
        var asked: Pair<String?, Int>? = null
        api.logsHandler = { s, l -> asked = s to l; LogsDto(listOf(LogDto("garmin", "info", "synced", "2026-11-04 03:00:01"))) }
        val rows = repo.logs("garmin", 5000).getOrThrow()
        assertEquals("garmin" to 500, asked)
        assertEquals("synced", rows.single().message)
        assertEquals(java.time.Instant.parse("2026-11-04T03:00:01Z"), rows.single().at)
        repo.logs(null, 0).getOrThrow()
        assertEquals(null to 1, asked)
    }

    @Test
    fun logSourcesPassThrough() = runTest {
        api.logSourcesHandler = { LogSourcesDto(listOf("garmin", "mx4")) }
        assertEquals(listOf("garmin", "mx4"), repo.logSources().getOrThrow())
        assertIs<Result<List<String>>>(repo.logSources())
    }

    @Test
    fun anUnreadableTimestampKeepsTheEntryWithoutATime() = runTest {
        api.logsHandler = { _, _ -> LogsDto(listOf(LogDto("garmin", "info", "synced", "not a time"))) }
        val row = repo.logs(null, 10).getOrThrow().single()
        assertEquals("synced", row.message)
        assertEquals(null, row.at)
    }

    @Test
    fun modelsPassThroughAndAFailureIsAFailure() = runTest {
        api.modelsHandler = { mapOf("google" to listOf("gemini-a")) }
        assertEquals(mapOf("google" to listOf("gemini-a")), repo.models().getOrThrow())
        api.modelsHandler = { throw IOException("down") }
        assertEquals(true, repo.models().isFailure)
    }
}
