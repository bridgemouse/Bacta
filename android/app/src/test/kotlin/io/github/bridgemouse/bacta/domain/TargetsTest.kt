package io.github.bridgemouse.bacta.domain

import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.Test

class TargetsTest {
    private val d = Targets.Default

    @Test
    fun defaultsAreValidAndUnchangedBySanitizing() = assertEquals(d, d.sanitized())

    @Test
    fun invalidTargetFallsBackToDefault() {
        assertEquals(d.sleepMinutes, d.copy(sleepMinutes = 0).sanitized().sleepMinutes)
        assertEquals(d.sleepMinutes, d.copy(sleepMinutes = -30).sanitized().sleepMinutes)
        assertEquals(d.sleepMinutes, d.copy(sleepMinutes = 100_000).sanitized().sleepMinutes)
        assertEquals(d.weeklyIntensityMinutes, d.copy(weeklyIntensityMinutes = 0).sanitized().weeklyIntensityMinutes)
        assertEquals(d.weeklyIntensityMinutes, d.copy(weeklyIntensityMinutes = -5).sanitized().weeklyIntensityMinutes)
    }

    @Test
    fun optionalGoalsThatAreNotPositiveAreTreatedAsNoGoal() {
        assertNull(d.copy(distanceMeters = 0).sanitized().distanceMeters)
        assertNull(d.copy(caloriesTotal = -1).sanitized().caloriesTotal)
        assertNull(d.copy(caloriesActive = 10_000_000).sanitized().caloriesActive)
        assertEquals(8000, d.copy(distanceMeters = 8000).sanitized().distanceMeters)
    }

    @Test
    fun trendWindowMustBeOneOfTheOfferedChoices() {
        assertEquals(7, d.copy(trendDays = 5).sanitized().trendDays)
        assertEquals(7, d.copy(trendDays = 0).sanitized().trendDays)
        Targets.TrendDayOptions.forEach { assertEquals(it, d.copy(trendDays = it).sanitized().trendDays) }
    }

    @Test
    fun validCustomValuesAreKept() {
        val custom = d.copy(sleepMinutes = 450, weeklyIntensityMinutes = 200, trendDays = 30)
        assertEquals(custom, custom.sanitized())
    }
}
