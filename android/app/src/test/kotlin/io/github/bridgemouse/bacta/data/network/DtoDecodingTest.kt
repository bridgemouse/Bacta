package io.github.bridgemouse.bacta.data.network

import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.serialization.decodeFromString
import org.junit.Test

class DtoDecodingTest {
    private fun fixture(name: String) =
        checkNotNull(javaClass.getResource("/fixtures/$name")) { "missing fixture $name" }.readText()

    @Test
    fun summaryDtoDecodesFixture() {
        val dto = BactaJson.decodeFromString<SummaryDto>(fixture("summary.json"))
        assertEquals(61.0, dto.hrv)
        assertEquals(14.5, dto.respAvg)
        assertEquals(88.0, dto.bodyBatteryWake)
        assertEquals("2026-11-02", dto.trainingStatusDate)
    }

    @Test
    fun summaryDtoLeavesAbsentMetricsNull() {
        val dto = BactaJson.decodeFromString<SummaryDto>("""{"hrv": 61}""")
        assertNull(dto.restingHr)
        assertNull(dto.sleepScore)
        assertNull(dto.trainingStatusDate)
    }

    @Test
    fun trendDtoDecodesFixture() {
        val dto = BactaJson.decodeFromString<TrendDto>(fixture("trend.json"))
        assertEquals(listOf("2026-10-30", "2026-10-31"), dto.rows.map { it.date })
        assertEquals(listOf(58.0, 61.5), dto.rows.map { it.value })
    }

    @Test
    fun briefingDtoDecodesFixtureWithGeneratedAt() {
        val dto = BactaJson.decodeFromString<BriefingDto>(fixture("briefing_live.json"))
        assertEquals("POSITIVE", dto.tone)
        assertEquals("2026-11-03T11:00:00Z", dto.generatedAt)
        assertEquals("synthetic-model", dto.model)
        assertEquals("One synthetic summary line.", dto.summary)
    }

    @Test
    fun briefingDtoDecodesFixtureWithoutGeneratedAt() {
        val dto = BactaJson.decodeFromString<BriefingDto>(fixture("briefing_stub.json"))
        assertNull(dto.generatedAt)
        assertNull(dto.summary)
        assertEquals(emptyList(), dto.flags)
    }

    @Test
    fun summaryCarriesSleepAndTrainingFields() {
        val dto = BactaJson.decodeFromString<SummaryDto>(fixture("summary.json"))
        assertEquals(4800.0, dto.sleepDeepS)
        assertEquals(480.0, dto.sleepAwakeS)
        assertEquals(96.0, dto.sleepSpo2)
        assertEquals(13.5, dto.sleepResp)
        assertEquals(10000.0, dto.stepsGoal)
        assertEquals(51.0, dto.vo2max)
        assertEquals(31.0, dto.fitnessAgeAchievable)
        assertEquals(480.0, dto.trainingLoadMax)
        assertEquals(30.0, dto.intensityModMin)
        assertEquals(12.0, dto.intensityVigMin)
        assertEquals(listOf(12.0, 25.0, 18.0, 6.0, 1.0), listOf(dto.hrzone1Min, dto.hrzone2Min, dto.hrzone3Min, dto.hrzone4Min, dto.hrzone5Min))
    }

    @Test
    fun activitiesDecodeIncludingPartialRows() {
        val dto = BactaJson.decodeFromString<ActivitiesDto>(fixture("activities.json"))
        assertEquals(2, dto.activities.size)
        assertEquals("1001", dto.activities[0].activityId.content)
        assertEquals("2026-11-03 07:15:00", dto.activities[0].startTime)
        assertNull(dto.activities[1].durationS)
        assertNull(dto.activities[1].distanceM)
    }

    @Test
    fun weeklyAndHypnogramShapesDecode() {
        assertEquals(listOf(4.5, 6.25), BactaJson.decodeFromString<WeeksDto>(fixture("weekly_volume.json")).weeks.map { it.hours })
        assertEquals(listOf(148.0, 151.0), BactaJson.decodeFromString<WeeksDto>(fixture("weekly_avg_hr.json")).weeks.map { it.avgHr })
        assertEquals(95.0, BactaJson.decodeFromString<IntensityDto>(fixture("weekly_intensity.json")).moderate)
        val h = BactaJson.decodeFromString<HypnoDto>(fixture("hypnogram.json"))
        assertEquals(24, h.hypno.size)
        assertEquals(1793750400000, h.startLocal)
    }
}
