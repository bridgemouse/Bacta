package io.github.bridgemouse.bacta.domain

/**
 * Personal goals the server and the system cannot supply. Each default is a polite, common value (Android's
 * settings guidance) and each is editable in Settings. Server goals (steps, floors) always win over these.
 */
data class Targets(
    val sleepMinutes: Int,
    val weeklyIntensityMinutes: Int,
    val distanceMeters: Int?,
    val caloriesTotal: Int?,
    val caloriesActive: Int?,
    val trendDays: Int,
) {
    /** Anything out of range falls back to the default (or, for optional goals, to "no goal") so a bad value can never divide by zero or draw a broken ring. */
    fun sanitized(): Targets = Targets(
        sleepMinutes = sleepMinutes.takeIf { it in SLEEP_MINUTES } ?: Default.sleepMinutes,
        weeklyIntensityMinutes = weeklyIntensityMinutes.takeIf { it in INTENSITY_MINUTES } ?: Default.weeklyIntensityMinutes,
        distanceMeters = distanceMeters?.takeIf { it in DISTANCE_METERS },
        caloriesTotal = caloriesTotal?.takeIf { it in CALORIES },
        caloriesActive = caloriesActive?.takeIf { it in CALORIES },
        trendDays = trendDays.takeIf { it in TrendDayOptions } ?: Default.trendDays,
    )

    companion object {
        private val SLEEP_MINUTES = 120..960
        private val INTENSITY_MINUTES = 10..2000
        private val DISTANCE_METERS = 1..200_000
        private val CALORIES = 1..20_000

        /** Chart windows offered in Settings. */
        val TrendDayOptions = listOf(7, 14, 30)

        val Default = Targets(
            sleepMinutes = 480, // 8 h: the long-standing convention the web used; adjustable
            weeklyIntensityMinutes = 150, // WHO guideline: 150 min of moderate activity per week
            distanceMeters = null,
            caloriesTotal = null,
            caloriesActive = null,
            trendDays = 7,
        )
    }
}
