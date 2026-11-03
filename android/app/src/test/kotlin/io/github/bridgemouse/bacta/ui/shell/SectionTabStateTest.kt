package io.github.bridgemouse.bacta.ui.shell

import kotlin.test.assertEquals
import org.junit.Test

class SectionTabStateTest {
    @Test
    fun startsOnOverview() = assertEquals(Tab.Overview, SectionTabState().tab)

    @Test
    fun resetReturnsToOverview() {
        val state = SectionTabState()
        state.tab = Tab.Trends
        state.reset()
        assertEquals(Tab.Overview, state.tab)
    }
}
