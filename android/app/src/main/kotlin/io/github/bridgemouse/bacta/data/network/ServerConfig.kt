package io.github.bridgemouse.bacta.data.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

/** The servers the app may talk to, and the one currently chosen. Cleartext is permitted only for these hosts (network_security_config.xml). */
class ServerConfig(val candidates: List<HttpUrl>, initial: HttpUrl? = null) {
    init {
        require(candidates.isNotEmpty()) { "at least one candidate server is required" }
    }

    @Volatile
    var current: HttpUrl = initial ?: candidates.first()
        private set

    fun choose(url: HttpUrl) {
        current = url
    }

    companion object {
        /** Hosts that may use cleartext HTTP. Must match `res/xml/network_security_config.xml`; a test compares the two. */
        val CLEARTEXT_HOSTS: List<String> = listOf("bacta.home", "192.168.1.119")

        val DEFAULT_CANDIDATES: List<HttpUrl> = listOf(
            "http://bacta.home/".toHttpUrl(),
            "http://192.168.1.119:3001/".toHttpUrl(),
        )
    }
}
