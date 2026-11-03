package io.github.bridgemouse.bacta.domain

enum class HrvDirection { Rising, Flat, Falling }

object HrvTrend {
    private const val MIN_POINTS = 3
    private const val FLAT_BAND_MS_PER_DAY = 0.3

    /** Least-squares slope in ms per day, treating the points as consecutive days. */
    fun slope(series: List<Double>): Double {
        val n = series.size
        val xMean = (n - 1) / 2.0
        val yMean = series.average()
        var num = 0.0
        var den = 0.0
        series.forEachIndexed { i, y ->
            num += (i - xMean) * (y - yMean)
            den += (i - xMean) * (i - xMean)
        }
        return if (den == 0.0) 0.0 else num / den
    }

    /** Null when there are too few points for a slope to mean anything. */
    fun direction(series: List<Double>): HrvDirection? {
        if (series.size < MIN_POINTS) return null
        val s = slope(series)
        return when {
            s > FLAT_BAND_MS_PER_DAY -> HrvDirection.Rising
            s < -FLAT_BAND_MS_PER_DAY -> HrvDirection.Falling
            else -> HrvDirection.Flat
        }
    }
}
