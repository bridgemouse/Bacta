package io.github.bridgemouse.bacta.domain

/** A named band; a null tone means "use the section accent". */
data class Band(val label: String, val tone: Tone?)

object ReadinessRules {
    fun scoreLabel(score: Double?): String? = when {
        score == null -> null
        score >= 80 -> "Optimal"
        score >= 67 -> "Ready"
        else -> "Low"
    }

    fun batteryBand(now: Double?): Band? = when {
        now == null -> null
        now >= 75 -> Band("HIGH", Tone.Positive)
        now >= 50 -> Band("MODERATE", Tone.Caution)
        now >= 25 -> Band("LOW", Tone.Caution)
        else -> Band("CRITICAL", Tone.Flag)
    }

    fun recoveryTimeBand(hours: Double?): Band? = when {
        hours == null -> null
        hours <= 0.0 -> Band("READY NOW", Tone.Positive)
        hours <= 24 -> Band("FRESH", null)
        hours <= 48 -> Band("RECOVERING", Tone.Caution)
        else -> Band("HEAVY LOAD", Tone.Flag)
    }

    fun recoveryTimePosition(hours: Double?): Float? =
        hours?.let { (it / RECOVERY_SCALE_HOURS).coerceIn(0.0, 1.0).toFloat() }

    private const val RECOVERY_SCALE_HOURS = 72.0
}
