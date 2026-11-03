package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.AuthStatusDto
import io.github.bridgemouse.bacta.data.network.FakeSessionStore
import io.github.bridgemouse.bacta.data.network.OkDto
import io.github.bridgemouse.bacta.data.network.ServerConfig
import io.github.bridgemouse.bacta.data.network.SessionEvents
import io.github.bridgemouse.bacta.data.network.VersionDto
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test
import retrofit2.Response

class AuthAndServerRepositoryTest {
    private val api = FakeBactaApi()
    private val store = FakeSessionStore("old")
    private val auth = DefaultAuthRepository(api, store, SessionEvents())

    private fun errorResponse(code: Int) = Response.error<OkDto>(code, "{}".toResponseBody("application/json".toMediaType()))

    @Test
    fun statusMapsFields() = runTest {
        api.statusHandler = { AuthStatusDto(configured = true, authed = false) }
        assertEquals(AuthStatus(configured = true, authed = false), auth.status().getOrThrow())
    }

    @Test
    fun loginMapsWrongPinAndNetworkFailure() = runTest {
        api.loginHandler = { Response.success(OkDto(true)) }
        assertEquals(LoginResult.Success, auth.login("1234"))
        api.loginHandler = { errorResponse(401) }
        assertEquals(LoginResult.WrongPin, auth.login("0000"))
        api.loginHandler = { errorResponse(500) }
        assertEquals(LoginResult.Failure, auth.login("0000"))
        api.loginHandler = { throw IOException("down") }
        assertEquals(LoginResult.Failure, auth.login("0000"))
    }

    @Test
    fun logoutClearsTheStoredSessionEvenWhenTheServerIsUnreachable() = runTest {
        api.logoutHandler = { throw IOException("down") }
        auth.logout()
        assertNull(store.cookie.first())
    }

    private val config = ServerConfig(listOf("http://a.test/".toHttpUrl(), "http://b.test/".toHttpUrl()))

    private fun server(appVersionApi: FakeBactaApi = api) = DefaultServerRepository(appVersionApi, config)

    @Test
    fun compatibilityDetectsAppTooOldBySemver() = runTest {
        api.versionHandler = { VersionDto("1.0.0", "0.10.0") }
        assertEquals(Compatibility.AppTooOld("0.10.0"), server().compatibility("0.9.0"))
        assertEquals(Compatibility.Ok, server().compatibility("0.10.0"))
        assertEquals(Compatibility.Ok, server().compatibility("0.10.1-debug"))
        assertEquals(Compatibility.Ok, server().compatibility("1.0.0"))
    }

    @Test
    fun compatibilityFallsBackToTheNextCandidateAndRemembersIt() = runTest {
        api.versionHandler = {
            if (config.current.host == "a.test") throw IOException("down") else VersionDto("1.0.0", "0.1.0")
        }
        assertEquals(Compatibility.Ok, server().compatibility("0.1.0"))
        assertEquals("b.test", config.current.host)
    }

    @Test
    fun compatibilityIsUnreachableWhenNoCandidateAnswers() = runTest {
        api.versionHandler = { throw IOException("down") }
        assertEquals(Compatibility.Unreachable, server().compatibility("0.1.0"))
    }
}
