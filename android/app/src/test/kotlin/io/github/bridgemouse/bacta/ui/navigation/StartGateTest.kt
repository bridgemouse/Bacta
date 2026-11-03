package io.github.bridgemouse.bacta.ui.navigation

import io.github.bridgemouse.bacta.data.repository.AuthStatus
import io.github.bridgemouse.bacta.data.repository.Compatibility
import java.io.IOException
import kotlin.test.assertEquals
import org.junit.Test

class StartGateTest {
    private val ok = Compatibility.Ok
    private fun auth(configured: Boolean, authed: Boolean) = Result.success(AuthStatus(configured, authed))

    @Test
    fun missingPermissionComesBeforeEverythingElse() {
        assertEquals(
            StartDestination.NeedsLocalNetwork,
            resolveStart(PermissionState.Missing, Compatibility.AppTooOld("9.0.0"), auth(true, true)),
        )
    }

    @Test
    fun appTooOldReportsTheMinimumVersion() {
        assertEquals(
            StartDestination.AppTooOld("0.2.0"),
            resolveStart(PermissionState.Granted, Compatibility.AppTooOld("0.2.0"), auth(true, true)),
        )
    }

    @Test
    fun unreachableServer() {
        assertEquals(
            StartDestination.ServerUnreachable,
            resolveStart(PermissionState.Granted, Compatibility.Unreachable, auth(true, true)),
        )
    }

    @Test
    fun configuredAndNotAuthedGoesToLogin() {
        assertEquals(StartDestination.Login, resolveStart(PermissionState.Granted, ok, auth(true, false)))
    }

    @Test
    fun configuredAndAuthedGoesHome() {
        assertEquals(StartDestination.Home, resolveStart(PermissionState.Granted, ok, auth(true, true)))
    }

    @Test
    fun notConfiguredIsAnOpenBox() {
        assertEquals(StartDestination.Home, resolveStart(PermissionState.Granted, ok, auth(false, false)))
    }

    @Test
    fun authStatusFailureIsNeverHome() {
        assertEquals(
            StartDestination.ServerUnreachable,
            resolveStart(PermissionState.Granted, ok, Result.failure(IOException("down"))),
        )
    }
}
