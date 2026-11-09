package io.github.bridgemouse.bacta.ui.shell

import io.github.bridgemouse.bacta.ui.UiText
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.designsystem.components.StateKind
import io.github.bridgemouse.bacta.ui.designsystem.components.StateMessage
import io.github.bridgemouse.bacta.ui.gates.AppTooOldScreen
import io.github.bridgemouse.bacta.ui.gates.LocalNetworkRequiredScreen
import io.github.bridgemouse.bacta.ui.gates.ServerUnreachableScreen

@Preview(widthDp = 411, heightDp = 800, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldHome() = BactaTheme {
    BactaScaffold(Section.Home, tabs = false, tabState = SectionTabState(), onBack = {}, onOpenSection = {}, onOpenSecondary = {}) {
        StateMessage(StateKind.Empty, UiText.Literal("Home content"))
    }
}

@Preview(widthDp = 411, heightDp = 800, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldRecovery() = BactaTheme {
    BactaScaffold(Section.Recovery, tabs = true, tabState = SectionTabState(Tab.Trends), onBack = {}, onOpenSection = {}, onOpenSecondary = {}) {
        StateMessage(StateKind.Empty, UiText.Literal("Recovery content"))
    }
}

@Preview(widthDp = 411, heightDp = 300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldStatusRunning() = BactaTheme {
    BactaScaffold(
        Section.Training, tabs = true, tabState = SectionTabState(), onBack = {}, onOpenSection = {}, onOpenSecondary = {},
        status = StatusBarState(SyncUi.Running(12), Mx4Status.Online),
    ) { StateMessage(StateKind.Empty, UiText.Literal("Training content")) }
}

@Preview(widthDp = 411, heightDp = 300, fontScale = 1.3f, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldStatusStaleLarge() = BactaTheme {
    BactaScaffold(
        Section.Recovery, tabs = true, tabState = SectionTabState(), onBack = {}, onOpenSection = {}, onOpenSecondary = {},
        status = StatusBarState(SyncUi.Failed, Mx4Status.Stale),
    ) { StateMessage(StateKind.Empty, UiText.Literal("Recovery content")) }
}

@Preview(widthDp = 411, heightDp = 300, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldHomeIdle() = BactaTheme {
    BactaScaffold(
        Section.Home, tabs = false, tabState = SectionTabState(), onBack = {}, onOpenSection = {}, onOpenSecondary = {},
        status = StatusBarState(SyncUi.Idle, Mx4Status.NoBriefing),
    ) { StateMessage(StateKind.Empty, UiText.Literal("Home content")) }
}

@Preview(widthDp = 411, heightDp = 600, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun GateLocalNetwork() = BactaTheme { LocalNetworkRequiredScreen(onRequest = {}) }

@Preview(widthDp = 411, heightDp = 600, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun GateAppTooOld() = BactaTheme { AppTooOldScreen("0.2.0") }

@Preview(widthDp = 411, heightDp = 600, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun GateUnreachable() = BactaTheme { ServerUnreachableScreen(onRetry = {}) }
