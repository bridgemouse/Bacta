package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.OkDto
import io.github.bridgemouse.bacta.data.network.BactaJson
import io.github.bridgemouse.bacta.data.network.SetPinRequest
import io.github.bridgemouse.bacta.data.network.SettingValueRequest
import io.github.bridgemouse.bacta.domain.SettingKey
import io.github.bridgemouse.bacta.domain.SettingsValidation
import javax.inject.Inject
import retrofit2.Response

sealed interface SaveResult {
    data object Saved : SaveResult
    /** A secret left blank or still masked: nothing was sent, so the stored key is untouched. */
    data object Unchanged : SaveResult
    /** Refused on the device by the same rules the server applies; nothing was sent. */
    data object Invalid : SaveResult
    /** The server answered 400; [message] is its own explanation. */
    data class Rejected(val message: String) : SaveResult
    data object Failure : SaveResult
}

sealed interface PinChangeResult {
    data object Success : PinChangeResult
    data object WrongCurrent : PinChangeResult
    data object BadFormat : PinChangeResult
    data object Failure : PinChangeResult
}

/** [at] is when the server logged it; null when the server's timestamp could not be read. */
data class LogEntry(val source: String, val level: String, val message: String, val at: java.time.Instant?)

data class ConnectionTest(val ok: Boolean, val error: String?)

interface SettingsRepository {
    /** The in-use settings as the server holds them; secrets arrive masked. */
    suspend fun load(): Result<Map<String, String>>

    /** Models offered per provider; the pickers fall back to the current value alone if this fails. */
    suspend fun models(): Result<Map<String, List<String>>>
    suspend fun save(key: String, value: String): SaveResult
    suspend fun testConnection(): Result<ConnectionTest>
    suspend fun changePin(current: String, new: String): PinChangeResult
    suspend fun logs(source: String?, limit: Int): Result<List<LogEntry>>
    suspend fun logSources(): Result<List<String>>
}

class DefaultSettingsRepository @Inject constructor(private val api: BactaApi) : SettingsRepository {
    private val secrets = SettingKey.All.filter { it.secret }.map { it.key }.toSet()
    private val known = SettingKey.All.map { it.key }.toSet()

    override suspend fun models(): Result<Map<String, List<String>>> = resultOf { api.models() }

    override suspend fun load(): Result<Map<String, String>> = resultOf { api.settings().filterKeys { it in known } }

    override suspend fun save(key: String, value: String): SaveResult {
        if (key in secrets && (value.isBlank() || SettingsValidation.isMasked(value))) return SaveResult.Unchanged
        if (!SettingsValidation.validate(key, value)) return SaveResult.Invalid
        val response = resultOf { api.putSetting(key, SettingValueRequest(value)) }.getOrElse { return SaveResult.Failure }
        return when {
            response.isSuccessful -> SaveResult.Saved
            response.code() == 400 -> SaveResult.Rejected(response.errorMessage() ?: key)
            else -> SaveResult.Failure
        }
    }

    override suspend fun testConnection(): Result<ConnectionTest> =
        resultOf { api.testConnection().let { ConnectionTest(it.ok, it.error) } }

    override suspend fun changePin(current: String, new: String): PinChangeResult {
        if (!SettingsValidation.isPinFormat(new)) return PinChangeResult.BadFormat
        val response = resultOf { api.setPin(SetPinRequest(pin = new, currentPin = current)) }.getOrElse { return PinChangeResult.Failure }
        return when {
            response.isSuccessful && response.body()?.ok == true -> PinChangeResult.Success
            response.code() == 401 -> PinChangeResult.WrongCurrent
            response.code() == 400 -> PinChangeResult.BadFormat
            else -> PinChangeResult.Failure
        }
    }

    override suspend fun logs(source: String?, limit: Int): Result<List<LogEntry>> =
        resultOf { api.logs(source?.takeIf { it.isNotEmpty() }, limit.coerceIn(1, MAX_LOG_LIMIT)).logs.map { LogEntry(it.source, it.level, it.message, parseServerTime(it.createdAt)) } }

    override suspend fun logSources(): Result<List<String>> = resultOf { api.logSources().sources }

    private companion object {
        /** The server caps `limit` at 500 and silently clamps; asking for more would only hide that. */
        const val MAX_LOG_LIMIT = 500
    }
}

/** SQLite's `datetime('now')` is UTC with no zone marker, so it is read as UTC and shown later in the device's zone. */
private fun parseServerTime(text: String): java.time.Instant? =
    runCatching { java.time.LocalDateTime.parse(text, java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")).toInstant(java.time.ZoneOffset.UTC) }.getOrNull()

private fun Response<OkDto>.errorMessage(): String? =
    runCatching { BactaJson.decodeFromString<OkDto>(errorBody()?.string().orEmpty()).error }.getOrNull()
