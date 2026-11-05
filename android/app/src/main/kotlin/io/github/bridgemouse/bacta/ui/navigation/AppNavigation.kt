package io.github.bridgemouse.bacta.ui.navigation

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSerializable
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.runtime.serialization.NavBackStackSerializer
import androidx.navigation3.runtime.serialization.NavKeySerializer
import androidx.navigation3.ui.NavDisplay
import io.github.bridgemouse.bacta.BuildConfig
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.gates.AppTooOldScreen
import io.github.bridgemouse.bacta.ui.gates.LocalNetworkRequiredScreen
import io.github.bridgemouse.bacta.ui.gates.ServerUnreachableScreen
import io.github.bridgemouse.bacta.ui.gates.rememberLocalNetworkPermission
import io.github.bridgemouse.bacta.ui.home.HomeRoute
import io.github.bridgemouse.bacta.ui.login.LoginRoute
import io.github.bridgemouse.bacta.ui.recovery.RecoveryRoute
import io.github.bridgemouse.bacta.ui.shell.BactaScaffold
import io.github.bridgemouse.bacta.ui.sleep.SleepRoute
import io.github.bridgemouse.bacta.ui.shell.Tab
import io.github.bridgemouse.bacta.ui.shell.rememberSectionTabState

/** Decides between the gate screens and the app itself. */
@Composable
fun AppRoot(viewModel: StartViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val permission = rememberLocalNetworkPermission()
    LaunchedEffect(permission.state) { viewModel.resolve(permission.state, BuildConfig.VERSION_NAME) }

    Box(Modifier.fillMaxSize().background(BactaPalette.Base)) {
        when (val start = state.start) {
            null -> StateMessage(StateKind.Loading, UiText.of(R.string.connecting))
            StartDestination.NeedsLocalNetwork -> LocalNetworkRequiredScreen(permission.request)
            is StartDestination.AppTooOld -> AppTooOldScreen(start.minApp)
            StartDestination.ServerUnreachable -> ServerUnreachableScreen { viewModel.resolve(permission.state, BuildConfig.VERSION_NAME) }
            StartDestination.Login, StartDestination.Home ->
                AppNavigation(loginRequired = state.loginRequired, onLoggedIn = viewModel::onLoggedIn)
        }
    }
}

@Composable
private fun AppNavigation(loginRequired: Boolean, onLoggedIn: () -> Unit) {
    val backStack = rememberNavBackStack<Destination>(if (loginRequired) Destination.Login else Destination.Home)
    LaunchedEffect(loginRequired) { backStack.reconcileLogin(loginRequired) }

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryDecorators = listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator(),
        ),
        entryProvider = entryProvider {
            entry<Destination.Login> { LoginRoute(onLoggedIn) }
            entry<Destination.Home> {
                SectionFrame(Section.Home, tabs = true, backStack = backStack) { tab ->
                    HomeRoute(tab, onOpenSection = backStack::openSection)
                }
            }
            entry<Destination.Recovery> {
                SectionFrame(Section.Recovery, tabs = true, backStack = backStack) { tab -> RecoveryRoute(tab) }
            }
            entry<Destination.Sleep> {
                SectionFrame(Section.Sleep, tabs = true, backStack = backStack) { tab -> SleepRoute(tab) }
            }
        },
    )
}

@Composable
private fun SectionFrame(
    section: Section,
    tabs: Boolean,
    backStack: NavBackStack<Destination>,
    content: @Composable (Tab) -> Unit,
) {
    val tabState = rememberSectionTabState(section)
    BactaScaffold(
        section = section,
        tabs = tabs,
        tabState = tabState,
        onBack = { backStack.removeLastOrNull() },
        onOpenSection = backStack::openSection,
    ) {
        content(tabState.tab)
    }
}

// NavBackStack<T> keeps the destination type; see https://issuetracker.google.com/issues/463382671
@Composable
private fun <T : NavKey> rememberNavBackStack(vararg elements: T): NavBackStack<T> =
    rememberSerializable(serializer = NavBackStackSerializer(elementSerializer = NavKeySerializer())) {
        NavBackStack(*elements)
    }
