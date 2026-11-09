package io.github.bridgemouse.bacta.ui.designsystem.components

import kotlin.test.assertEquals
import org.junit.Test

class MarkdownBlocksTest {
    @Test
    fun headingsBulletsAndParagraphsBecomeBlocks() {
        val blocks = markdownBlocks("## Recovery\nText line one\n- first\n* second\n\n### Detail\nLast **bold** line")
        assertEquals(
            listOf(
                MarkdownBlock.Heading("Recovery", 2),
                MarkdownBlock.Paragraph("Text line one"),
                MarkdownBlock.Bullet("first"),
                MarkdownBlock.Bullet("second"),
                MarkdownBlock.Heading("Detail", 3),
                MarkdownBlock.Paragraph("Last **bold** line"),
            ),
            blocks,
        )
    }

    @Test
    fun blankInputHasNoBlocksAndMarkersWithoutTextAreDropped() {
        assertEquals(emptyList(), markdownBlocks(""))
        assertEquals(emptyList(), markdownBlocks("  \n\n##\n-  "))
    }

    @Test
    fun aHashInsideTextIsNotAHeading() {
        assertEquals(listOf(MarkdownBlock.Paragraph("Zone #2 is aerobic")), markdownBlocks("Zone #2 is aerobic"))
    }
}
