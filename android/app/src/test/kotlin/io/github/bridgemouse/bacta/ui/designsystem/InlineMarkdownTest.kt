package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import io.github.bridgemouse.bacta.ui.designsystem.components.inlineMarkdown
import kotlin.test.assertEquals
import org.junit.Test

class InlineMarkdownTest {
    @Test
    fun boldMarkersAreRemovedAndTheInnerTextIsBold() {
        val out = inlineMarkdown("HRV of **57ms** is low")
        assertEquals("HRV of 57ms is low", out.text)
        val span = out.spanStyles.single()
        assertEquals(FontWeight.Bold, span.item.fontWeight)
        assertEquals(7 to 11, span.start to span.end)
    }

    @Test
    fun italicMarkers() {
        val out = inlineMarkdown("a *b* c")
        assertEquals("a b c", out.text)
        assertEquals(FontStyle.Italic, out.spanStyles.single().item.fontStyle)
    }

    @Test
    fun unmatchedAndSpacedAsterisksStayLiteral() {
        assertEquals("**open", inlineMarkdown("**open").text)
        assertEquals("2 * 3 * 4", inlineMarkdown("2 * 3 * 4").text)
        assertEquals("plain", inlineMarkdown("plain").text)
    }

    @Test
    fun severalSpansInOneString() {
        val out = inlineMarkdown("**a** and **b**")
        assertEquals("a and b", out.text)
        assertEquals(2, out.spanStyles.size)
    }
}
