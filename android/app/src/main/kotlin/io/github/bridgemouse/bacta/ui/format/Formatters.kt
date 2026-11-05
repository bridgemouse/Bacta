package io.github.bridgemouse.bacta.ui.format

import androidx.compose.runtime.staticCompositionLocalOf
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.UiText
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToInt

data class FormattedMeasure(val value: String, val unit: UiText)

enum class MeasurementSystem { Metric, Imperial }

/** Which system a locale uses for distances; the Android implementation asks ICU. */
fun interface MeasurementSystemProvider {
    fun systemFor(locale: Locale): MeasurementSystem
}

/** Numbers, durations, distances and dates for the current locale and the system 12/24 h setting. Nothing here is an app setting. */
interface Formatters {
    fun number(v: Double, decimals: Int): String
    fun distance(meters: Double): FormattedMeasure
    fun duration(seconds: Double): UiText?
    fun dateTime(at: Instant, zone: ZoneId): UiText
    fun timeOfDay(at: Instant, zone: ZoneId): String
    fun shortDate(d: LocalDate): String
    fun weekdayInitial(d: LocalDate): String
}

class LocaleFormatters(
    private val locale: Locale,
    private val is24Hour: Boolean,
    private val system: MeasurementSystemProvider,
) : Formatters {
    override fun number(v: Double, decimals: Int): String =
        NumberFormat.getInstance(locale).apply {
            minimumFractionDigits = decimals
            maximumFractionDigits = decimals
        }.format(v)

    override fun distance(meters: Double): FormattedMeasure = when (system.systemFor(locale)) {
        MeasurementSystem.Imperial -> FormattedMeasure(number(meters / METERS_PER_MILE, 1), UiText.of(R.string.unit_mi))
        MeasurementSystem.Metric -> FormattedMeasure(number(meters / 1000.0, 1), UiText.of(R.string.unit_km))
    }

    override fun duration(seconds: Double): UiText? {
        if (seconds <= 0) return null
        val minutes = (seconds / 60).roundToInt()
        val h = minutes / 60
        val m = minutes % 60
        return when {
            h == 0 -> UiText.of(R.string.duration_m, m)
            m == 0 -> UiText.of(R.string.duration_h, h)
            else -> UiText.of(R.string.duration_hm, h, m)
        }
    }

    /** The system clock setting decides 12 vs 24 h, as Android's i18n guidance says ICU/java.time do not observe it on their own. */
    override fun dateTime(at: Instant, zone: ZoneId): UiText {
        val local = at.atZone(zone)
        val date = DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT).withLocale(locale).format(local)
        val time = clock().format(local)
        return UiText.of(R.string.datetime_join, date, time)
    }

    override fun timeOfDay(at: Instant, zone: ZoneId): String = clock().format(at.atZone(zone))

    private fun clock(): DateTimeFormatter =
        if (is24Hour) DateTimeFormatter.ofPattern("HH:mm", locale) else DateTimeFormatter.ofPattern("h:mm a", locale)

    override fun shortDate(d: LocalDate): String = DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT).withLocale(locale).format(d)

    override fun weekdayInitial(d: LocalDate): String = d.dayOfWeek.getDisplayName(TextStyle.SHORT, locale)

    private companion object {
        const val METERS_PER_MILE = 1609.344
    }
}

/** Default for previews and tests; the app provides the injected instance at the root. */
val LocalFormatters = staticCompositionLocalOf<Formatters> {
    LocaleFormatters(Locale.getDefault(), is24Hour = true) { MeasurementSystem.Metric }
}
