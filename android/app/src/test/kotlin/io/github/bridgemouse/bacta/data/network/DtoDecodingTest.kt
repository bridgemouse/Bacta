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
}
