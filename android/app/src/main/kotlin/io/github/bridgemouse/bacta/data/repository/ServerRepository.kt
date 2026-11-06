package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.ServerConfig
import javax.inject.Inject

interface ServerRepository {
    suspend fun compatibility(appVersion: String): Compatibility

    /** The version string the connected server reports, for the About screen. */
    suspend fun serverVersion(): Result<String>
}

class DefaultServerRepository @Inject constructor(
    private val api: BactaApi,
    private val config: ServerConfig,
) : ServerRepository {
    override suspend fun serverVersion(): Result<String> = resultOf { api.version().server }

    /** Tries the remembered server first, then the other candidates, and keeps whichever answers. */
    override suspend fun compatibility(appVersion: String): Compatibility {
        val original = config.current
        val order = listOf(original) + config.candidates.filter { it != original }
        for (candidate in order) {
            config.choose(candidate)
            val version = resultOf { api.version() }.getOrNull() ?: continue
            return if (compareVersions(appVersion, version.minApp) < 0) Compatibility.AppTooOld(version.minApp) else Compatibility.Ok
        }
        config.choose(original)
        return Compatibility.Unreachable
    }
}

/** Numeric per component, so 0.9.0 < 0.10.0; a suffix such as "-debug" is ignored. */
internal fun compareVersions(a: String, b: String): Int {
    fun parts(v: String) = v.split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
    val pa = parts(a)
    val pb = parts(b)
    for (i in 0 until maxOf(pa.size, pb.size)) {
        val c = (pa.getOrElse(i) { 0 }).compareTo(pb.getOrElse(i) { 0 })
        if (c != 0) return c
    }
    return 0
}
