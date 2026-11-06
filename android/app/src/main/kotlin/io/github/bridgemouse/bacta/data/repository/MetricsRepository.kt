package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.SummaryDto
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

interface MetricsRepository {
    suspend fun summary(): Result<Summary>

    /** Like [trends] but keeps each reading's date, so charts can label days and screens can tell how old the latest value is. */
    suspend fun points(
        metrics: Set<Metric>,
        days: Int = 7,
        today: LocalDate = LocalDate.now(),
    ): Map<Metric, Result<List<TrendPoint>>>

    /** One failing metric does not fail the others. Dates are the device's local calendar days. */
    suspend fun trends(
        metrics: Set<Metric>,
        days: Int = 7,
        today: LocalDate = LocalDate.now(),
    ): Map<Metric, Result<List<Double>>>
}

class DefaultMetricsRepository @Inject constructor(private val api: BactaApi) : MetricsRepository {
    override suspend fun summary(): Result<Summary> = resultOf { api.summary().toDomain() }

    override suspend fun points(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<TrendPoint>>> {
        val from = today.minusDays(days - 1L).toString()
        val to = today.toString()
        return coroutineScope {
            metrics.map { metric ->
                async {
                    metric to resultOf {
                        api.trend(metric.key, from, to).rows.mapNotNull { row ->
                            row.value?.let { TrendPoint(LocalDate.parse(row.date), it / metric.divisor) }
                        }
                    }
                }
            }.awaitAll().toMap()
        }
    }

    override suspend fun trends(metrics: Set<Metric>, days: Int, today: LocalDate): Map<Metric, Result<List<Double>>> =
        points(metrics, days, today).mapValues { (_, result) -> result.map { list -> list.map(TrendPoint::value) } }
}

private fun SummaryDto.toDomain() = Summary(
    hrv = hrv,
    hrvWeekAvg = hrvWeekAvg,
    restingHr = restingHr,
    stressAvg = stressAvg,
    stressMax = stressMax,
    respAvg = respAvg,
    spo2Avg = spo2Avg,
    recoveryScore = recoveryScore,
    recoveryTimeHours = recoveryTimeH?.div(Metric.RecoveryTime.divisor),
    bodyBatteryWake = bodyBatteryWake,
    bodyBatteryCurrent = bodyBatteryCurrent,
    hrvBaselineLow = hrvBaselineLow,
    hrvBaselineHigh = hrvBaselineHigh,
    sleepHr = sleepHr,
    sleepStress = sleepStress,
    sleepScore = sleepScore,
    sleepSeconds = sleepS ?: stageTotal(),
    trainingLoad = trainingLoad,
    trainingStatusN = trainingStatusN,
    trainingStatusDate = trainingStatusDate,
    sleepDeepSeconds = sleepDeepS,
    sleepLightSeconds = sleepLightS,
    sleepRemSeconds = sleepRemS,
    sleepAwakeSeconds = sleepAwakeS,
    sleepSpo2 = sleepSpo2,
    sleepResp = sleepResp,
    distanceMeters = distanceM,
    steps = steps,
    stepsGoal = stepsGoal,
    caloriesTotal = caloriesTotal,
    caloriesActive = caloriesActive,
    floorsUp = floorsUp,
    floorsGoal = floorsGoal,
    vo2max = vo2max,
    fitnessAge = fitnessAge,
    fitnessAgeAchievable = fitnessAgeAchievable,
    trainingLoadMin = trainingLoadMin,
    trainingLoadMax = trainingLoadMax,
    intensityModMin = intensityModMin,
    intensityVigMin = intensityVigMin,
    hrZoneMinutes = listOf(hrzone1Min, hrzone2Min, hrzone3Min, hrzone4Min, hrzone5Min),
)

/** The total is sparse on the server; the stage sum is only trusted when every stage is present. */
private fun SummaryDto.stageTotal(): Double? =
    if (sleepDeepS != null && sleepLightS != null && sleepRemS != null) sleepDeepS + sleepLightS + sleepRemS else null
