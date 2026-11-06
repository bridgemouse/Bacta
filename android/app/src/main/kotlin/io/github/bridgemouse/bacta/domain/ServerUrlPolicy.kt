package io.github.bridgemouse.bacta.domain

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

sealed interface ServerUrlCheck {
    data object Allowed : ServerUrlCheck
    data object Malformed : ServerUrlCheck
    /** Plain HTTP to [host] would be refused by the system's network security config. */
    data class CleartextBlocked(val host: String) : ServerUrlCheck
}

/** Applies the same rule as the manifest's network security config: HTTPS anywhere, HTTP only to the declared hosts. */
object ServerUrlPolicy {
    fun check(url: String, cleartextHosts: Collection<String>): ServerUrlCheck {
        val parsed = url.toHttpUrlOrNull() ?: return ServerUrlCheck.Malformed
        return if (parsed.isHttps || parsed.host in cleartextHosts) ServerUrlCheck.Allowed else ServerUrlCheck.CleartextBlocked(parsed.host)
    }
}
