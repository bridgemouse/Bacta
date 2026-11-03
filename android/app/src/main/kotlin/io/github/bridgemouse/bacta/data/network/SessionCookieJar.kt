package io.github.bridgemouse.bacta.data.network

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

const val SESSION_COOKIE = "bacta_session"

/**
 * Keeps only the server's session cookie, and keeps it host-independent: the same token is valid
 * whichever candidate server answered. Runs on OkHttp's worker threads, never the main thread,
 * so blocking on the store is safe.
 */
class SessionCookieJar(private val store: SessionStore) : CookieJar {
    private val lock = Any()
    private var primed = false
    private var token: String? = null

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val cookie = cookies.lastOrNull { it.name == SESSION_COOKIE } ?: return
        val expired = cookie.value.isEmpty() || cookie.expiresAt < System.currentTimeMillis()
        synchronized(lock) {
            token = if (expired) null else cookie.value
            primed = true
        }
        runBlocking { if (expired) store.clear() else store.save(cookie.value) }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val value = synchronized(lock) {
            if (!primed) {
                token = runBlocking { store.cookie.first() }
                primed = true
            }
            token
        } ?: return emptyList()
        return listOf(Cookie.Builder().name(SESSION_COOKIE).value(value).hostOnlyDomain(url.host).build())
    }
}
