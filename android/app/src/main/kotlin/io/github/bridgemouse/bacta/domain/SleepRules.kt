package io.github.bridgemouse.bacta.domain

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.nextUp
import kotlin.math.roundToInt

/**
 * Typical adult proportions of total sleep time (StatPearls, "Physiology, Sleep Stages"): deep (N3) 15–25 %, REM 20–25 %,
 * wake 5 % or less. The weights are Bacta's own composite, not Garmin's.
 */
data class ArchitectureTargets(
    val deepShare: Double = 0.20,
    val remShare: Double = 0.22,
    val awakeShare: Double = 0.05,
    val deepWeight: Double = 0.4,
    val remWeight: Double = 0.4,
    val awakeWeight: Double = 0.2,
)

/** Each sub-score is 0 to 1: 1 means the night met or beat its target. */
data class Architecture(val score: Int, val deepScore: Double, val remScore: Double, val awakeScore: Double)

object SleepRules {
    private const val NEG = Double.NEGATIVE_INFINITY

    /** Garmin's published ranges (garmin.com blog): excellent 90–100, good 80–89, fair 60–79, poor below 60. Its "0–60" for poor overlaps fair at 60; 60 is treated as fair. */
    private val scoreBands = BandTable(
        listOf(
            BandRow(90.0, Band("Excellent", Tone.Positive)),
            BandRow(80.0, Band("Good", Tone.Positive)),
            BandRow(60.0, Band("Fair", Tone.Caution)),
            BandRow(NEG, Band("Poor", Tone.Flag)),
        ),
    )

    fun scoreBand(score: Double?): Band? = scoreBands.select(score)?.value

    private val architectureBands = BandTable(
        listOf(
            BandRow(80.0, Band("OPTIMAL", Tone.Positive)),
            BandRow(60.0, Band("FAIR", Tone.Caution)),
            BandRow(NEG, Band("NEEDS WORK", Tone.Flag)),
        ),
    )

    fun architectureBand(score: Double?): Band? = architectureBands.select(score)?.value

    /** Cumulative shortfall against [targetMinutes]: a well-rested night counts as zero and never offsets another night's debt. */
    fun debtMinutes(nights: List<Int>, targetMinutes: Int): Int = nights.sumOf { max(0, targetMinutes - it) }

    fun efficiencyPercent(asleepMin: Int, awakeMin: Int): Int? {
        val inBed = asleepMin + awakeMin
        return if (inBed <= 0) null else (asleepMin * 100.0 / inBed).roundToInt()
    }

    /** Deep, light and REM shares that always add up to exactly 100 (largest-remainder rounding). */
    fun stagePercents(deep: Int, light: Int, rem: Int): List<Int> {
        val parts = listOf(deep, light, rem)
        val total = parts.sum()
        if (total <= 0) return listOf(0, 0, 0)
        val exact = parts.map { it * 100.0 / total }
        val floors = exact.map { floor(it).toInt() }.toMutableList()
        val order = exact.indices.sortedByDescending { exact[it] - floors[it] }
        repeat(100 - floors.sum()) { floors[order[it]]++ }
        return floors
    }

    fun architecture(deepMin: Int, remMin: Int, awakeMin: Int, totalMin: Int, targets: ArchitectureTargets = ArchitectureTargets()): Architecture? {
        if (totalMin <= 0) return null
        val deep = min(deepMin / (totalMin * targets.deepShare), 1.0)
        val rem = min(remMin / (totalMin * targets.remShare), 1.0)
        val awake = (2 - awakeMin / (totalMin * targets.awakeShare)).coerceIn(0.0, 1.0)
        val score = ((deep * targets.deepWeight + rem * targets.remWeight + awake * targets.awakeWeight) * 100).roundToInt()
        return Architecture(score, deep, rem, awake)
    }
}
