package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

/** MX-4 writes **bold** and *italic*; nothing else is interpreted. A marker with no closing partner, or one touching whitespace, stays literal. */
fun inlineMarkdown(text: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < text.length) {
        val bold = text.startsWith("**", i)
        val marker = if (bold) "**" else if (text[i] == '*') "*" else null
        val close = marker?.let { closingMarker(text, i, it) } ?: -1
        if (marker != null && close >= 0) {
            val style = if (bold) SpanStyle(fontWeight = FontWeight.Bold) else SpanStyle(fontStyle = FontStyle.Italic)
            withStyle(style) { append(text.substring(i + marker.length, close)) }
            i = close + marker.length
        } else {
            append(text[i])
            i++
        }
    }
}

private fun closingMarker(text: String, open: Int, marker: String): Int {
    val start = open + marker.length
    if (start >= text.length || text[start].isWhitespace()) return -1
    var j = text.indexOf(marker, start)
    while (j >= 0) {
        if (j > start && !text[j - 1].isWhitespace()) return j
        j = text.indexOf(marker, j + 1)
    }
    return -1
}
