package io.github.bridgemouse.bacta.ui.metrics

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.testFormatters
import io.github.bridgemouse.bacta.ui.UiText
import kotlin.test.assertEquals
import org.junit.Test

class TrendSpecTest {
    private val specs = listOf(
        TrendSpec(UiText.Literal("HRV"), Metric.Hrv, UiText.Literal("hrv caption")),
        TrendSpec(UiText.Literal("RHR"), Metric.RestingHr, UiText.Literal("rhr caption")),
    )
    private val week = listOf(54.0, 56.0, 55.0, 58.0, 60.0, 59.0, 62.0)

    @Test
    fun aSectionWithoutASeriesIsOmitted() {
        val sections = buildTrendSections(specs, Summary(hrv = 62.0), { if (it == Metric.Hrv) week else emptyList() }, testFormatters)
        assertEquals(listOf("HRV"), sections.map { it.rail.s() })
    }

    @Test
    fun theWindowDrivesThePeriodTextWithoutAnyLiteral() {
        val section = buildTrendSections(specs, Summary(), { week }, testFormatters, days = 14).first()
        assertEquals("14 days", section.card.period.s())
        assertEquals(UiText.plural(R.plurals.period_days, 14, 14), section.card.period)
    }

    @Test
    fun unitsDecimalsAndDeltaDirectionComeFromTheCatalog() {
        val sections = buildTrendSections(specs, Summary(restingHr = 52.0, hrv = 62.0, hrvWeekAvg = 58.0), { week }, testFormatters)
        val hrv = sections[0].card
        assertEquals("ms", hrv.unit.s())
        assertEquals(58.0, hrv.average)
        assertEquals("▲ 4", hrv.delta?.text.s())
        val rhr = sections[1].card
        assertEquals("52", rhr.value)
        assertEquals("bpm", rhr.unit.s())
    }

    @Test
    fun aChangeThatRoundsToZeroIsFlatNotAnArrow() {
        val section = buildTrendSections(specs.take(1), Summary(hrv = 62.0, hrvWeekAvg = 61.8), { week }, testFormatters).single()
        assertEquals("→ 0", section.card.delta?.text.s())
        assertEquals(io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection.Flat, section.card.delta?.direction)
    }
}
