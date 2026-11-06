package io.github.bridgemouse.bacta.domain

/** [chronic] is Garmin's chronic load; [state] says where the acute load sits against Garmin's optimal range. */
data class LoadRatio(val value: Double, val chronic: Double, val state: Band)

object TrainingRules {
    /**
     * Garmin's optimal acute:chronic range is 0.8 to 1.5. Checked on the live database: the stored
     * `training_load_max / training_load_min` is exactly 1.875 = 1.5 / 0.8 every day, and `acute / (min / 0.8)` matches the
     * `dailyAcuteChronicWorkloadRatio` in Garmin's own payload, so chronic load is recovered from the stored range.
     */
    const val OPTIMAL_LOW = 0.8
    const val OPTIMAL_HIGH = 1.5

    private val low = Band("Low", Tone.Caution)
    private val optimal = Band("Optimal", Tone.Positive)
    private val high = Band("High", Tone.Flag)

    /** Where today's acute load falls against Garmin's own optimal range for the day. */
    fun loadState(load: Double?, min: Double?, max: Double?): Band? = when {
        load == null || min == null || max == null -> null
        load < min -> low
        load > max -> high
        else -> optimal
    }

    fun loadRatio(acute: Double?, min: Double?, max: Double?): LoadRatio? {
        if (acute == null || min == null || min <= 0.0) return null
        val chronic = min / OPTIMAL_LOW
        val ratio = acute / chronic
        val state = when {
            ratio < OPTIMAL_LOW - 1e-9 -> low
            ratio > OPTIMAL_HIGH + 1e-9 -> high
            else -> optimal
        }
        return LoadRatio(ratio, chronic, state)
    }

    /** Whole-number shares of today's zone time that add up to exactly 100; null when there is no zone time at all. */
    fun zonePercents(minutes: List<Double?>): List<Int>? {
        val parts = minutes.map { it ?: 0.0 }
        val total = parts.sum()
        if (total <= 0.0) return null
        val exact = parts.map { it * 100.0 / total }
        val floors = exact.map { kotlin.math.floor(it).toInt() }.toMutableList()
        val order = exact.indices.sortedByDescending { exact[it] - floors[it] }
        repeat(100 - floors.sum()) { floors[order[it]]++ }
        return floors
    }

    /** Garmin counts vigorous minutes twice toward the weekly intensity goal. */
    fun intensityPoints(moderate: Double, vigorous: Double): Double = moderate + 2 * vigorous
}
