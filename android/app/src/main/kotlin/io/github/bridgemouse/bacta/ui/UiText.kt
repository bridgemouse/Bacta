package io.github.bridgemouse.bacta.ui

import android.content.Context
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * User-facing text that is still a resource reference. Mappings build these without a Context, so they stay
 * plain-JVM testable; the UI resolves them. [Literal] is for text that is data, not copy (server text, formatted numbers).
 */
sealed interface UiText {
    data class Res(@StringRes val id: Int, val args: List<Any> = emptyList()) : UiText
    data class Plural(@PluralsRes val id: Int, val count: Int, val args: List<Any> = emptyList()) : UiText
    data class Literal(val value: String) : UiText

    companion object {
        fun of(@StringRes id: Int, vararg args: Any): UiText = Res(id, args.toList())
        fun plural(@PluralsRes id: Int, count: Int, vararg args: Any): UiText = Plural(id, count, args.toList())
    }
}

private fun List<Any>.resolved(context: Context): Array<Any> =
    map { if (it is UiText) it.resolve(context) else it }.toTypedArray()

fun UiText.resolve(context: Context): String = when (this) {
    is UiText.Literal -> value
    // getString(id, args) always formats, so a string with a literal "%" and no arguments must use the plain overload.
    is UiText.Res -> if (args.isEmpty()) context.getString(id) else context.getString(id, *args.resolved(context))
    is UiText.Plural -> context.resources.getQuantityString(id, count, *args.resolved(context))
}

@Composable
fun UiText.asString(): String = resolve(LocalContext.current)

@Composable
fun UiText?.asStringOrNull(): String? = this?.asString()
