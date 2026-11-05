package io.github.bridgemouse.bacta.domain

import io.github.bridgemouse.bacta.ui.format.Formatters
import java.time.Instant
import java.time.ZoneOffset

enum class SleepStage { Deep, Light, Rem, Awake }

object Hypnogram {
    /**
     * The server resamples Garmin's activity levels (0 deep, 1 light, 2 REM, 3 awake, checked against live stage totals) and
     * emits `3 - level`, so a value of 3 is deep and 0 is awake.
     */
    fun stage(level: Int): SleepStage? = when (level) {
        3 -> SleepStage.Deep
        2 -> SleepStage.Light
        1 -> SleepStage.Rem
        0 -> SleepStage.Awake
        else -> null
    }

    /**
     * Garmin's local timestamps encode the wall-clock time as if it were UTC, so they are formatted in UTC: the device's own
     * zone would shift them a second time. Without both times there are no labels, never invented ones.
     */
    fun axisLabels(startLocalMs: Long?, endLocalMs: Long?, fmt: Formatters, ticks: Int = 5): List<String> {
        if (startLocalMs == null || endLocalMs == null || ticks < 2) return emptyList()
        return (0 until ticks).map { i ->
            val ms = startLocalMs + (endLocalMs - startLocalMs) * i / (ticks - 1)
            fmt.timeOfDay(Instant.ofEpochMilli(ms), ZoneOffset.UTC)
        }
    }
}
