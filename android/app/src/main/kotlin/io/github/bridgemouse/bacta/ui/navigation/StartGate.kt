package io.github.bridgemouse.bacta.ui.navigation

import io.github.bridgemouse.bacta.data.repository.AuthStatus
import io.github.bridgemouse.bacta.data.repository.Compatibility

enum class PermissionState { Granted, Missing }

sealed interface StartDestination {
    data object NeedsLocalNetwork : StartDestination
    data class AppTooOld(val minApp: String) : StartDestination
    data object ServerUnreachable : StartDestination
    data object Login : StartDestination
    data object Home : StartDestination
}

/** Decides what the app shows first. A failed auth check is never treated as "no PIN set", so it can't open the app. */
fun resolveStart(permission: PermissionState, compat: Compatibility, auth: Result<AuthStatus>): StartDestination = when {
    permission == PermissionState.Missing -> StartDestination.NeedsLocalNetwork
    compat is Compatibility.AppTooOld -> StartDestination.AppTooOld(compat.minApp)
    compat is Compatibility.Unreachable -> StartDestination.ServerUnreachable
    else -> auth.fold(
        onSuccess = { if (it.configured && !it.authed) StartDestination.Login else StartDestination.Home },
        onFailure = { StartDestination.ServerUnreachable },
    )
}
