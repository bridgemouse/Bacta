package io.github.bridgemouse.bacta.ui.format

import io.github.bridgemouse.bacta.s
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

class FormattersTest {
    private fun fmt(locale: Locale, is24Hour: Boolean, system: MeasurementSystem) =
        LocaleFormatters(locale, is24Hour) { system }

    private val us = fmt(Locale.US, is24Hour = false, system = MeasurementSystem.Imperial)
    private val de = fmt(Locale.GERMANY, is24Hour = true, system = MeasurementSystem.Metric)
    private val noon = Instant.parse("2026-11-03T14:00:00Z")

    @Test
    fun formattersFollowLocaleAndClockSetting() {
        assertEquals("1,234.5", us.number(1234.5, 1))
        assertEquals("1.234,5", de.number(1234.5, 1))

        val usTime = us.dateTime(noon, ZoneId.of("UTC")).s()!!
        assertTrue("2:00" in usTime && usTime.contains("PM", ignoreCase = true), usTime)
        val deTime = de.dateTime(noon, ZoneId.of("UTC")).s()!!
        assertTrue("14:00" in deTime, deTime)
        assertTrue("03.11" in deTime, deTime)
    }

    @Test
    fun theSystemClockSettingWinsOverTheLocaleDefault() {
        val usOn24 = fmt(Locale.US, is24Hour = true, system = MeasurementSystem.Imperial)
        assertTrue("14:00" in usOn24.dateTime(noon, ZoneId.of("UTC")).s()!!)
    }

    @Test
    fun distanceFollowsTheMeasurementSystem() {
        val miles = us.distance(8046.72)
        assertEquals("5.0", miles.value)
        assertEquals("mi", miles.unit.s())
        val km = de.distance(8046.72)
        assertEquals("8,0", km.value)
        assertEquals("km", km.unit.s())
    }

    @Test
    fun durationFormatsHoursAndMinutes() {
        assertEquals("7h 38m", us.duration(27480.0).s())
        assertEquals("7h", us.duration(25200.0).s())
        assertEquals("45m", us.duration(2700.0).s())
        assertNull(us.duration(0.0))
    }

    @Test
    fun numberHonorsDecimals() {
        assertEquals("62", us.number(61.6, 0))
        assertEquals("61.60", us.number(61.6, 2))
    }

    @Test
    fun datesAndWeekdaysUseTheLocale() {
        val d = LocalDate.of(2026, 11, 4)
        assertEquals("Wed", us.weekdayInitial(d))
        assertEquals("Mi.", de.weekdayInitial(d))
        assertTrue("11" in us.shortDate(d))
    }

    @Test
    fun timeOfDayHonorsTheClockSettingAndTheGivenZone() {
        assertTrue(us.timeOfDay(noon, ZoneId.of("UTC")).let { "2:00" in it && it.contains("PM", ignoreCase = true) })
        assertEquals("14:00", de.timeOfDay(noon, ZoneId.of("UTC")))
        assertEquals("09:00", de.timeOfDay(noon, ZoneId.of("America/New_York")))
    }
}
