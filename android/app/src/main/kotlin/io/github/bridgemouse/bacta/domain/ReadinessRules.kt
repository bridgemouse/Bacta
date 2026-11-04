package io.github.bridgemouse.bacta.domain

import kotlin.math.nextUp

/** A named band; a null tone means "use the section accent". */
data class Band(val label: String, val tone: Tone?)

object ReadinessRules {
    private const val NEG = Double.NEGATIVE_INFINITY

    // Tables are data: edit a row, not an `if` chain. Upper-inclusive limits (<= 24 h) are written as nextUp() lower bounds.
    private val scoreBands = BandTable(listOf(BandRow(80.0, "Optimal"), BandRow(67.0, "Ready"), BandRow(NEG, "Low")))

    private val batteryBands = BandTable(
        listOf(
            BandRow(75.0, Band("HIGH", Tone.Positive)),
            BandRow(50.0, Band("MODERATE", Tone.Caution)),
            BandRow(25.0, Band("LOW", Tone.Caution)),
            BandRow(NEG, Band("CRITICAL", Tone.Flag)),
        ),
    )

    private val recoveryTimeBands = BandTable(
        listOf(
            BandRow(48.0.nextUp(), Band("HEAVY LOAD", Tone.Flag)),
            BandRow(24.0.nextUp(), Band("RECOVERING", Tone.Caution)),
            BandRow(0.0.nextUp(), Band("FRESH", null)),
            BandRow(NEG, Band("READY NOW", Tone.Positive)),
        ),
    )

    private val stressLabels = BandTable(
        listOf(BandRow(76.0, "VERY HIGH"), BandRow(51.0, "HIGH"), BandRow(26.0, "MODERATE"), BandRow(NEG, "LOW")),
    )

    private val sleepStressBands = BandTable(
        listOf(
            BandRow(51.0, Band("ELEVATED", Tone.Caution)),
            BandRow(26.0, Band("LOW–MODERATE", Tone.Caution)),
            BandRow(NEG, Band("LOW · rest zone", Tone.Positive)),
        ),
    )

    private val respirationBands = BandTable(
        listOf(
            BandRow(20.0.nextUp(), Band("outside 12–20", Tone.Caution)),
            BandRow(12.0, Band("12–20 normal", Tone.Positive)),
            BandRow(NEG, Band("outside 12–20", Tone.Caution)),
        ),
    )

    private val spo2Bands = BandTable(
        listOf(
            BandRow(97.0, Band("excellent", Tone.Positive)),
            BandRow(95.0, Band("normal", Tone.Positive)),
            BandRow(NEG, Band("below normal", Tone.Caution)),
        ),
    )

    fun scoreLabel(score: Double?): String? = scoreBands.select(score)?.value
    fun batteryBand(now: Double?): Band? = batteryBands.select(now)?.value
    fun recoveryTimeBand(hours: Double?): Band? = recoveryTimeBands.select(hours)?.value
    fun stressLabel(avg: Double?): String? = stressLabels.select(avg)?.value
    fun sleepStressBand(avg: Double?): Band? = sleepStressBands.select(avg)?.value
    fun respirationBand(breathsPerMinute: Double?): Band? = respirationBands.select(breathsPerMinute)?.value
    fun spo2Band(percent: Double?): Band? = spo2Bands.select(percent)?.value

    fun recoveryTimePosition(hours: Double?): Float? =
        hours?.let { (it / RECOVERY_SCALE_HOURS).coerceIn(0.0, 1.0).toFloat() }





    private const val RECOVERY_SCALE_HOURS = 72.0
}
