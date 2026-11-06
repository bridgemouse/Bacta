package io.github.bridgemouse.bacta.ui.metrics

import io.github.bridgemouse.bacta.data.repository.Metric
import io.github.bridgemouse.bacta.data.repository.Summary
import io.github.bridgemouse.bacta.data.repository.valueOf
import io.github.bridgemouse.bacta.s
import io.github.bridgemouse.bacta.ui.designsystem.components.TrendKind
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.junit.Test

class MetricCatalogTest {
    @Test
    fun everyMetricHasACatalogEntry() {
        Metric.entries.forEach { assertNotNull(MetricCatalog.spec(it), "no catalog entry for $it") }
    }

    @Test
    fun catalogCarriesUnitsDecimalsDirectionAndChartKind() {
        val rhr = MetricCatalog.spec(Metric.RestingHr)
        assertEquals("bpm", rhr.unit.s())
        assertEquals(true, rhr.lowerIsBetter)
        val battery = MetricCatalog.spec(Metric.BodyBatteryWake)
        assertEquals(TrendKind.Bars, battery.chart)
        assertNull(battery.lowerIsBetter)
        assertEquals(1, MetricCatalog.spec(Metric.RespAvg).decimals)
        assertEquals(1, MetricCatalog.spec(Metric.Vo2Max).decimals)
        assertEquals(false, MetricCatalog.spec(Metric.Hrv).lowerIsBetter)
    }

    @Test
    fun summaryValueOfReadsTheFieldForEachSummaryMetric() {
        val s = Summary(hrv = 61.0, restingHr = 52.0, recoveryTimeHours = 12.0, bodyBatteryCurrent = 64.0, trainingLoad = 410.0)
        assertEquals(61.0, s.valueOf(Metric.Hrv))
        assertEquals(52.0, s.valueOf(Metric.RestingHr))
        assertEquals(12.0, s.valueOf(Metric.RecoveryTime))
        assertEquals(64.0, s.valueOf(Metric.BodyBatteryCurrent))
        assertEquals(410.0, s.valueOf(Metric.TrainingLoad))
        assertNull(s.valueOf(Metric.StressAvg))
    }
}
