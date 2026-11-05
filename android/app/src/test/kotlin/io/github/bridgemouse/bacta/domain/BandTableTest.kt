package io.github.bridgemouse.bacta.domain

import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.Test

class BandTableTest {
    private val table = BandTable(
        listOf(
            BandRow(min = 80.0, value = "high"),
            BandRow(min = 50.0, value = "mid"),
            BandRow(min = Double.NEGATIVE_INFINITY, value = "low"),
        ),
    )

    @Test
    fun bandTableSelectsOnBothSidesOfEveryBoundary() {
        assertEquals("high", table.select(80.0)?.value)
        assertEquals("mid", table.select(79.999)?.value)
        assertEquals("mid", table.select(50.0)?.value)
        assertEquals("low", table.select(49.999)?.value)
        assertEquals("low", table.select(-1000.0)?.value)
    }

    @Test
    fun nullValueSelectsNothing() = assertNull(table.select(null))

    @Test
    fun rowOrderDoesNotMatter() {
        val shuffled = BandTable(listOf(BandRow(50.0, "mid"), BandRow(Double.NEGATIVE_INFINITY, "low"), BandRow(80.0, "high")))
        assertEquals("high", shuffled.select(90.0)?.value)
        assertEquals("low", shuffled.select(10.0)?.value)
    }

    @Test
    fun aValueBelowEveryRowSelectsNothing() {
        assertNull(BandTable(listOf(BandRow(10.0, "x"))).select(9.0))
    }
}
