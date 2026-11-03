package io.github.bridgemouse.bacta.ui.designsystem.components

import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor

enum class DeltaDirection { Good, Bad, Flat }

/** Locale-independent number text; a missing value is a dash, never a fake number. */
fun formatValue(value: Double?, decimals: Int = 0): String =
    if (value == null) "—" else String.format(Locale.ROOT, "%.${decimals}f", value)

fun deltaDirection(delta: Double, lowerIsBetter: Boolean): DeltaDirection = when {
    delta == 0.0 -> DeltaDirection.Flat
    (delta > 0) != lowerIsBetter -> DeltaDirection.Good
    else -> DeltaDirection.Bad
}

fun formatDelta(delta: Double?, decimals: Int): String? {
    if (delta == null) return null
    val magnitude = formatValue(abs(delta), decimals)
    return when {
        delta > 0 -> "▲ $magnitude"
        delta < 0 -> "▼ $magnitude"
        else -> "→ $magnitude"
    }
}

/** Text a screen reader announces for a drawn trend chart. */
fun describeSeries(label: String, series: List<Double>, period: String): String {
    if (series.isEmpty()) return "$label: no data"
    val decimals = if (series.all { it == floor(it) }) 0 else 1
    fun f(v: Double) = formatValue(v, decimals)
    return "$label, $period: from ${f(series.first())} to ${f(series.last())}, high ${f(series.max())}, low ${f(series.min())}"
}
