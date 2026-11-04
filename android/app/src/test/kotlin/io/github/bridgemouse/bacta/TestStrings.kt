package io.github.bridgemouse.bacta

import io.github.bridgemouse.bacta.ui.UiText
import java.io.File
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element

/** Resolves [UiText] to the English resource text in plain JVM tests, reading the same XML the app ships. */
object TestStrings {
    private val ids: Map<Int, String> =
        R.string::class.java.fields.associate { it.getInt(null) to it.name } +
            R.plurals::class.java.fields.associate { it.getInt(null) to it.name }

    private val strings: Map<String, String> = parse("src/main/res/values/strings.xml", "string")
    private val plurals: Map<String, Map<String, String>> = parsePlurals("src/main/res/values/plurals.xml")

    private fun doc(path: String) = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File(path)).documentElement

    private fun unescape(s: String) = s.replace("\\'", "'").replace("\\\"", "\"").replace("\\n", "\n")

    private fun parse(path: String, tag: String): Map<String, String> {
        val nodes = doc(path).getElementsByTagName(tag)
        return (0 until nodes.length).map { nodes.item(it) as Element }.associate { it.getAttribute("name") to unescape(it.textContent) }
    }

    private fun parsePlurals(path: String): Map<String, Map<String, String>> {
        val nodes = doc(path).getElementsByTagName("plurals")
        return (0 until nodes.length).map { nodes.item(it) as Element }.associate { p ->
            val items = p.getElementsByTagName("item")
            p.getAttribute("name") to (0 until items.length).map { items.item(it) as Element }
                .associate { it.getAttribute("quantity") to unescape(it.textContent) }
        }
    }

    private fun args(list: List<Any>): Array<Any> = list.map { if (it is UiText) resolve(it) else it }.toTypedArray()

    fun resolve(text: UiText): String = when (text) {
        is UiText.Literal -> text.value
        is UiText.Res -> strings.getValue(ids.getValue(text.id)).let { t ->
            if (text.args.isEmpty()) t else String.format(Locale.US, t, *args(text.args))
        }
        is UiText.Plural -> {
            val table = plurals.getValue(ids.getValue(text.id))
            val template = if (text.count == 1) table["one"] ?: table.getValue("other") else table.getValue("other")
            String.format(Locale.US, template, *args(text.args))
        }
    }
}

fun UiText?.s(): String? = this?.let(TestStrings::resolve)

/** en-US with a 12 h clock, the formatting the English assertions in tests assume. */
val testFormatters = io.github.bridgemouse.bacta.ui.format.LocaleFormatters(Locale.US, is24Hour = false) {
    io.github.bridgemouse.bacta.ui.format.MeasurementSystem.Imperial
}
