package io.github.bridgemouse.bacta.ui.navigation

import app.cash.turbine.test
import io.github.bridgemouse.bacta.data.repository.AuthRepository
import io.github.bridgemouse.bacta.data.repository.AuthStatus
import io.github.bridgemouse.bacta.data.repository.Compatibility
import io.github.bridgemouse.bacta.data.repository.LoginResult
import io.github.bridgemouse.bacta.data.repository.ServerRepository
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeServer(var result: Compatibility = Compatibility.Ok) : ServerRepository {
    var calls = 0
    var seenVersion: String? = null
    override suspend fun compatibility(appVersion: String): Compatibility {
        calls++
        seenVersion = appVersion
        return result
    }
}

private class FakeAuth(var status: Result<AuthStatus>) : AuthRepository {
    val expired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    var statusCalls = 0
    override val sessionExpired = expired
    override suspend fun status(): Result<AuthStatus> { statusCalls++; return status }
    override suspend fun login(pin: String) = LoginResult.Success
    override suspend fun logout() = Unit
}

@OptIn(ExperimentalCoroutinesApi::class)
class StartViewModelTest {
    private val server = FakeServer()
    private val auth = FakeAuth(Result.success(AuthStatus(configured = true, authed = true)))

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = StartViewModel(server, auth)

    @Test
    fun resolvingIsTheInitialState() = runTest {
        assertNull(vm().state.value.start)
    }

    @Test
    fun missingPermissionDoesNotTouchTheNetwork() = runTest {
        val vm = vm()
        vm.resolve(PermissionState.Missing, "0.1.0")
        assertEquals(StartDestination.NeedsLocalNetwork, vm.state.value.start)
        assertEquals(0, server.calls)
        assertEquals(0, auth.statusCalls)
    }

    @Test
    fun grantedPermissionResolvesHomeAndPassesTheAppVersion() = runTest {
        val vm = vm()
        vm.resolve(PermissionState.Granted, "0.1.0")
        assertEquals(StartDestination.Home, vm.state.value.start)
        assertEquals("0.1.0", server.seenVersion)
    }

    @Test
    fun anUnreachableServerSkipsTheAuthCall() = runTest {
        server.result = Compatibility.Unreachable
        val vm = vm()
        vm.resolve(PermissionState.Granted, "0.1.0")
        assertEquals(StartDestination.ServerUnreachable, vm.state.value.start)
        assertEquals(0, auth.statusCalls)
    }

    @Test
    fun sessionExpiryRoutesToLoginExactlyOnce() = runTest {
        val vm = vm()
        vm.resolve(PermissionState.Granted, "0.1.0")
        vm.state.test {
            assertFalse(awaitItem().loginRequired)
            auth.expired.emit(Unit)
            assertTrue(awaitItem().loginRequired)
            auth.expired.emit(Unit)
            expectNoEvents()
        }
    }

    @Test
    fun loggingInClearsTheLoginRequirement() = runTest {
        auth.status = Result.success(AuthStatus(configured = true, authed = false))
        val vm = vm()
        vm.resolve(PermissionState.Granted, "0.1.0")
        assertTrue(vm.state.value.loginRequired)
        vm.onLoggedIn()
        assertFalse(vm.state.value.loginRequired)
        assertEquals(StartDestination.Home, vm.state.value.start)
    }
}
