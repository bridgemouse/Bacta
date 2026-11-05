package io.github.bridgemouse.bacta

import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

/**
 * Ratchet: user-facing text in `ui/` comes from string resources (docs: localization), never from a literal
 * passed to a text composable. Preview and catalog files are synthetic gallery content and are exempt.
 */
class NoHardcodedUiTextTest {
    private val forbidden = listOf(
        Regex("""\bText\(\s*(?:text\s*=\s*)?""""),
        Regex("""\b(?:contentDescription|stateDescription)\s*=\s*""""),
        Regex("""\b(?:Chip|SectionRail|GateButton)\(\s*""""),
    )

    private fun violations(source: String): List<String> =
        forbidden.flatMap { rule -> rule.findAll(source).map { it.value.trim() }.toList() }

    private fun exempt(file: File) = file.name.let { it.contains("Preview") || it == "Catalog.kt" || it == "ThemeSwatch.kt" }

    @Test
    fun scannerFlagsLiteralText() {
        assertEquals(1, violations("""Text("Hello")""").size)
        assertEquals(1, violations("Text(\n    text = \"Hi\"").size)
        assertEquals(1, violations("""Modifier.semantics { contentDescription = "x" }""").size)
        assertTrue(violations("""Text(stringResource(R.string.x))""").isEmpty())
    }

    @Test
    fun noUiFileHardcodesUserFacingText() {
        val root = File("src/main/kotlin/io/github/bridgemouse/bacta/ui")
        val offenders = root.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && !exempt(it) }
            .flatMap { file -> violations(file.readText()).map { "${file.relativeTo(root)}: $it" }.asSequence() }
            .toList()
        assertTrue(offenders.isEmpty(), "Hardcoded UI text (move it to strings.xml):\n" + offenders.joinToString("\n"))
    }
}
