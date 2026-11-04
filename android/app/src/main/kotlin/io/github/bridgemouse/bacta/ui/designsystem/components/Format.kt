package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.format.Formatters
import kotlin.math.abs
import kotlin.math.floor

enum class DeltaDirection { Good, Bad, Flat }

fun deltaDirection(delta: Double, lowerIsBetter: Boolean): DeltaDirection = when {
    delta == 0.0 -> DeltaDirection.Flat
    (delta > 0) != lowerIsBetter -> DeltaDirection.Good
    else -> DeltaDirection.Bad
}

/** "▲ 3", "▼ 0.5" or "→ 0" with the number in the current locale; null when there is no delta. */
fun Formatters.delta(delta: Double?, decimals: Int): UiText? {
    if (delta == null) return null
    val magnitude = number(abs(delta), decimals)
    return when {
        delta > 0 -> UiText.of(R.string.delta_up, magnitude)
        delta < 0 -> UiText.of(R.string.delta_down, magnitude)
        else -> UiText.of(R.string.delta_flat, magnitude)
    }
}

/** What a screen reader announces for a drawn trend chart. */
fun describeSeries(fmt: Formatters, label: UiText, series: List<Double>, period: UiText): UiText {
    if (series.isEmpty()) return UiText.of(R.string.cd_series_empty, label)
    val decimals = if (series.all { it == floor(it) }) 0 else 1
    fun f(v: Double) = fmt.number(v, decimals)
    return UiText.of(R.string.cd_series, label, period, f(series.first()), f(series.last()), f(series.max()), f(series.min()))
}
