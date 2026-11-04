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

    fun stressLabel(avg: Double?): String? = when {
        avg == null -> null
        avg < 26 -> "LOW"
        avg < 51 -> "MODERATE"
        avg < 76 -> "HIGH"
        else -> "VERY HIGH"
    }

    fun sleepStressBand(avg: Double?): Band? = when {
        avg == null -> null
        avg < 26 -> Band("LOW · rest zone", Tone.Positive)
        avg < 51 -> Band("LOW–MODERATE", Tone.Caution)
        else -> Band("ELEVATED", Tone.Caution)
    }

    fun respirationBand(breathsPerMinute: Double?): Band? = when {
        breathsPerMinute == null -> null
        breathsPerMinute in 12.0..20.0 -> Band("12–20 normal", Tone.Positive)
        else -> Band("outside 12–20", Tone.Caution)
    }

    fun spo2Band(percent: Double?): Band? = when {
        percent == null -> null
        percent >= 97 -> Band("excellent", Tone.Positive)
        percent >= 95 -> Band("normal", Tone.Positive)
        else -> Band("below normal", Tone.Caution)
    }

    private const val RECOVERY_SCALE_HOURS = 72.0
}
