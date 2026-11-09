package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.domain.Section
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

class SectionIconsTest {
    @Test
    fun everySectionHasA24dpIconThatDrawsSomething() {
        Section.entries.forEach { section ->
            val icon = SectionIcons.of(section)
            assertEquals(24f, icon.defaultWidth.value, section.name)
            assertEquals(24f, icon.defaultHeight.value, section.name)
            assertTrue(icon.root.size > 0, "${section.name} icon is empty")
        }
    }

    @Test
    fun theIconsAreDistinctPerSection() {
        val icons = Section.entries.map { SectionIcons.of(it) }
        assertEquals(icons.size, icons.toSet().size)
    }
}
