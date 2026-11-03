package io.github.bridgemouse.bacta.ui.shell

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
    BactaScaffold(Section.Home, tabs = false, tabState = SectionTabState(), onBack = {}, onOpenSection = {}) {
        StateMessage(StateKind.Empty, "Home content")
    }
}

@Preview(widthDp = 411, heightDp = 800, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
private fun ScaffoldRecovery() = BactaTheme {
    BactaScaffold(Section.Recovery, tabs = true, tabState = SectionTabState(Tab.Trends), onBack = {}, onOpenSection = {}) {
        StateMessage(StateKind.Empty, "Recovery content")
    }
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
