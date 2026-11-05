package io.github.bridgemouse.bacta

import java.io.File
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/** Resource lint that runs without a device: every format string must format with the arguments its placeholders ask for. */
class StringResourcesTest {
    private val positional = Regex("""%(\d+)\$[sdf]""")

    private fun entries(tag: String, path: String): List<Pair<String, String>> {
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File(path)).documentElement
        val nodes = doc.getElementsByTagName(tag)
        return (0 until nodes.length).map { nodes.item(it) as Element }.flatMap { el ->
            if (tag == "plurals") {
                val items = el.getElementsByTagName("item")
                (0 until items.length).map { el.getAttribute("name") to (items.item(it) as Element).textContent }
            } else listOf(el.getAttribute("name") to el.textContent)
        }
    }

    @Test
    fun everyFormatStringFormatsWithItsOwnPlaceholders() {
        val all = entries("string", "src/main/res/values/strings.xml") + entries("plurals", "src/main/res/values/plurals.xml")
        val broken = all.mapNotNull { (name, raw) ->
            val text = raw.replace("\\'", "'")
            val count = positional.findAll(text).maxOfOrNull { it.groupValues[1].toInt() } ?: 0
            if (count == 0) return@mapNotNull null
            runCatching { String.format(Locale.US, text, *Array<Any>(count) { 1 }) }.exceptionOrNull()?.let { "$name: ${it.message}" }
        }
        assertTrue(broken.isEmpty(), "Broken format strings:\n" + broken.joinToString("\n"))
    }

    @Test
    fun stringsWithoutPlaceholdersDoNotCarryAnAccidentalFormatSpecifier() {
        val all = entries("string", "src/main/res/values/strings.xml")
        val suspicious = all.filter { (_, text) -> !positional.containsMatchIn(text) && Regex("""%[sdf]|%%""").containsMatchIn(text) }
        assertTrue(suspicious.isEmpty(), "Unformatted strings with format specifiers: $suspicious")
    }
}
