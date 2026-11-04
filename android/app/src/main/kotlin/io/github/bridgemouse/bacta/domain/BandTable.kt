package io.github.bridgemouse.bacta.domain

/** One band: [min] is its inclusive lower bound. Use `Double.NEGATIVE_INFINITY` for the catch-all lowest band. */
data class BandRow<T>(val min: Double, val value: T)

/** Thresholds as data: the row with the highest lower bound at or below the value wins, whatever order the rows were given in. */
class BandTable<T>(rows: List<BandRow<T>>) {
    private val sorted = rows.sortedByDescending { it.min }

    fun select(value: Double?): BandRow<T>? = value?.let { v -> sorted.firstOrNull { v >= it.min } }
}
