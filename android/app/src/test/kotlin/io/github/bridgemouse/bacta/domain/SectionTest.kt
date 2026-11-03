package io.github.bridgemouse.bacta.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class SectionTest {
    @Test
    fun keysAreTheApiSectionIds() {
        assertEquals(listOf("home", "recovery", "training", "sleep"), Section.entries.map { it.key })
    }

    @Test
    fun labelsMatchTheWebTheme() {
        assertEquals(listOf("Home", "Recovery", "Training", "Sleep"), Section.entries.map { it.label })
    }
}
