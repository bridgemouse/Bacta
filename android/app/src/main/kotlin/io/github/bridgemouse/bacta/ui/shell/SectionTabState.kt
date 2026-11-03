package io.github.bridgemouse.bacta.ui.shell

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import io.github.bridgemouse.bacta.domain.Section

enum class Tab { Overview, Trends }

/** UI state shared by a section's screen and its dock toggle. A plain holder: it is not business logic, so no ViewModel. */
class SectionTabState(initial: Tab = Tab.Overview) {
    var tab by mutableStateOf(initial)

    fun reset() {
        tab = Tab.Overview
    }

    companion object {
        val Saver = listSaver<SectionTabState, String>(
            save = { listOf(it.tab.name) },
            restore = { SectionTabState(Tab.valueOf(it[0])) },
        )
    }
}

/** Keyed by section, so moving to another section starts on Overview. */
@Composable
fun rememberSectionTabState(section: Section): SectionTabState =
    rememberSaveable(section, saver = SectionTabState.Saver) { SectionTabState() }
