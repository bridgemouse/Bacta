package io.github.bridgemouse.bacta.ui.login

import io.github.bridgemouse.bacta.data.repository.AuthRepository
import io.github.bridgemouse.bacta.data.repository.AuthStatus
import io.github.bridgemouse.bacta.data.repository.LoginResult
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeAuth(var result: suspend () -> LoginResult = { LoginResult.Success }) : AuthRepository {
    val pins = mutableListOf<String>()
    override val sessionExpired = emptyFlow<Unit>()
    override suspend fun status(): Result<AuthStatus> = Result.success(AuthStatus(true, false))
    override suspend fun login(pin: String): LoginResult { pins += pin; return result() }
    override suspend fun logout() = Unit
}

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {
    private val auth = FakeAuth()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun pinKeepsOnlyDigitsAndCapsAtTwelve() = runTest {
        val vm = LoginViewModel(auth)
        vm.onPinChanged("12ab34-56 78901234567")
        assertEquals("123456789012", vm.state.value.pin)
    }

    @Test
    fun submitIsIgnoredBelowFourDigits() = runTest {
        val vm = LoginViewModel(auth)
        vm.onPinChanged("123")
        vm.onSubmit()
        assertTrue(auth.pins.isEmpty())
        assertFalse(vm.state.value.busy)
    }

    @Test
    fun wrongPinSetsErrorAndClearsPin() = runTest {
        auth.result = { LoginResult.WrongPin }
        val vm = LoginViewModel(auth)
        vm.onPinChanged("0000")
        vm.onSubmit()
        assertEquals(LoginError.WrongPin, vm.state.value.error)
        assertEquals("", vm.state.value.pin)
        assertFalse(vm.state.value.busy)
    }

    @Test
    fun successSetsDone() = runTest {
        val vm = LoginViewModel(auth)
        vm.onPinChanged("1234")
        vm.onSubmit()
        assertTrue(vm.state.value.done)
        assertEquals(listOf("1234"), auth.pins)
    }

    @Test
    fun networkFailureSetsConnectionErrorAndKeepsPin() = runTest {
        auth.result = { LoginResult.Failure }
        val vm = LoginViewModel(auth)
        vm.onPinChanged("1234")
        vm.onSubmit()
        assertEquals(LoginError.Connection, vm.state.value.error)
        assertEquals("1234", vm.state.value.pin)
        assertFalse(vm.state.value.done)
    }

    @Test
    fun typingClearsTheError() = runTest {
        auth.result = { LoginResult.WrongPin }
        val vm = LoginViewModel(auth)
        vm.onPinChanged("0000")
        vm.onSubmit()
        vm.onPinChanged("1")
        assertNull(vm.state.value.error)
    }

    @Test
    fun aSecondSubmitWhileBusyIsIgnored() = runTest {
        val gate = CompletableDeferred<LoginResult>()
        auth.result = { gate.await() }
        val vm = LoginViewModel(auth)
        vm.onPinChanged("1234")
        vm.onSubmit()
        vm.onSubmit()
        assertTrue(vm.state.value.busy)
        assertEquals(1, auth.pins.size)
        gate.complete(LoginResult.Success)
        assertTrue(vm.state.value.done)
    }
}
