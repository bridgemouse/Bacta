package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.ui.designsystem.components.ColumnItem
import io.github.bridgemouse.bacta.ui.designsystem.components.Placement
import io.github.bridgemouse.bacta.ui.designsystem.components.columnCountFor
import io.github.bridgemouse.bacta.ui.designsystem.components.layoutHeight
import io.github.bridgemouse.bacta.ui.designsystem.components.placeColumns
import kotlin.test.assertEquals
import org.junit.Test

class AdaptiveColumnsTest {
    private fun cards(vararg h: Int) = h.map { ColumnItem(it, fullWidth = false) }

    @Test
    fun cardsAlternateAcrossBothColumnsWhenTheyAreEqual() {
        val p = placeColumns(cards(100, 100, 100, 100), columns = 2, gap = 10)
        assertEquals(listOf(Placement(0, 0), Placement(1, 0), Placement(0, 110), Placement(1, 110)), p)
    }

    @Test
    fun theShorterColumnTakesTheNextCard() {
        val p = placeColumns(cards(200, 50, 50, 50), columns = 2, gap = 10)
        assertEquals(listOf(0, 1, 1, 1), p.map { it.column })
        assertEquals(listOf(0, 0, 60, 120), p.map { it.y })
    }

    @Test
    fun aFullWidthItemWaitsForBothColumnsAndStartsNewRows() {
        val p = placeColumns(listOf(ColumnItem(100, false), ColumnItem(50, false), ColumnItem(30, true), ColumnItem(80, false)), columns = 2, gap = 10)
        assertEquals(Placement(-1, 110), p[2])
        assertEquals(Placement(0, 150), p[3])
    }

    @Test
    fun anOddCountLeavesTheLastColumnShort() {
        val p = placeColumns(cards(100, 100, 100), columns = 2, gap = 10)
        assertEquals(listOf(0, 1, 0), p.map { it.column })
        assertEquals(210, layoutHeight(cards(100, 100, 100), p, gap = 10))
    }

    @Test
    fun oneColumnStacksEverythingInOrder() {
        val p = placeColumns(listOf(ColumnItem(100, false), ColumnItem(40, true), ColumnItem(60, false)), columns = 1, gap = 10)
        assertEquals(listOf(0, 110, 160), p.map { it.y })
        assertEquals(listOf(0, -1, 0), p.map { it.column })
    }

    @Test
    fun noItemsHaveNoHeight() {
        assertEquals(0, layoutHeight(emptyList(), emptyList(), gap = 10))
    }

    @Test
    fun twoColumnsStartAtTheExpandedWidthBreakpoint() {
        assertEquals(1, columnCountFor(839f))
        assertEquals(2, columnCountFor(840f))
        assertEquals(2, columnCountFor(1100f))
    }
}
