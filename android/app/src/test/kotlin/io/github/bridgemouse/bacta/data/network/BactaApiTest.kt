package io.github.bridgemouse.bacta.data.network

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BactaApiTest {
    private val server = MockWebServer()
    private val store = FakeSessionStore()
    private val events = SessionEvents()
    private lateinit var config: ServerConfig
    private lateinit var api: BactaApi

    @Before
    fun setUp() {
        server.start()
        config = ServerConfig(listOf(server.url("/")))
        api = createBactaApi(createHttpClient(config, SessionCookieJar(store), events))
    }

    @After
    fun tearDown() = server.close()

    private fun json(code: Int = 200, body: String) =
        MockResponse.Builder().code(code).addHeader("Content-Type", "application/json").body(body).build()

    @Test
    fun loginStoresCookieAndLaterRequestsSendIt() = runTest {
        server.enqueue(
            MockResponse.Builder().code(200)
                .addHeader("Set-Cookie", "bacta_session=abc; Path=/; HttpOnly; SameSite=Lax")
                .addHeader("Content-Type", "application/json")
                .body("""{"ok":true}""").build(),
        )
        server.enqueue(json(body = "{}"))

        assertEquals(true, api.login(LoginRequest("1234")).body()?.ok)
        api.summary()

        assertEquals("abc", store.cookie.first())
        server.takeRequest()
        assertEquals("bacta_session=abc", server.takeRequest().headers["Cookie"])
    }

    @Test
    fun logoutExpiringTheCookieClearsTheStore() = runTest {
        store.save("abc")
        server.enqueue(
            MockResponse.Builder().code(200)
                .addHeader("Set-Cookie", "bacta_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
                .addHeader("Content-Type", "application/json")
                .body("""{"ok":true}""").build(),
        )
        api.logout()
        assertNull(store.cookie.first())
    }

    @Test
    fun baseUrlInterceptorRewritesHostAndPort() = runTest {
        server.enqueue(json(body = """{"server":"1.0.0","minApp":"0.1.0"}"""))
        assertEquals("1.0.0", api.version().server)
        assertEquals("/api/version", server.takeRequest().url.encodedPath)
    }

    @Test
    fun chosenServerIsUsedForLaterRequests() = runTest {
        val other = MockWebServer().apply { start() }
        try {
            config.choose(other.url("/"))
            other.enqueue(json(body = """{"server":"2.0.0","minApp":"0.1.0"}"""))
            assertEquals("2.0.0", api.version().server)
            assertEquals(0, server.requestCount)
        } finally {
            other.close()
        }
    }

    @Test
    fun http401OnDataEndpointRaisesSessionExpiredAndEmitsOnce() = runTest(UnconfinedTestDispatcher()) {
        val emissions = mutableListOf<Unit>()
        backgroundScope.launch { events.expired.collect { emissions += it } }
        server.enqueue(json(code = 401, body = """{"error":"Unauthorized"}"""))

        assertFailsWith<SessionExpiredException> { api.summary() }
        assertEquals(1, emissions.size)
    }

    @Test
    fun http401OnLoginIsAWrongPinNotASessionExpiry() = runTest(UnconfinedTestDispatcher()) {
        val emissions = mutableListOf<Unit>()
        backgroundScope.launch { events.expired.collect { emissions += it } }
        server.enqueue(json(code = 401, body = """{"ok":false,"error":"Incorrect PIN"}"""))

        val response = api.login(LoginRequest("0000"))

        assertEquals(401, response.code())
        assertEquals(0, emissions.size)
    }

    @Test
    fun trendRequestCarriesTheRange() = runTest {
        server.enqueue(json(body = """{"rows":[]}"""))
        api.trend("hrv", "2026-10-27", "2026-11-03")
        val url = server.takeRequest().url
        assertEquals("/api/garmin/hrv", url.encodedPath)
        assertEquals("2026-10-27", url.queryParameter("from"))
        assertEquals("2026-11-03", url.queryParameter("to"))
    }

    @Test
    fun serverConfigRejectsAnEmptyCandidateList() {
        assertFailsWith<IllegalArgumentException> { ServerConfig(emptyList()) }
        assertEquals("http://bacta.home/".toHttpUrl(), ServerConfig.DEFAULT_CANDIDATES.first())
    }
}
