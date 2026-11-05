package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.ActivityDto
import io.github.bridgemouse.bacta.data.network.BactaApi
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

interface ActivityRepository {
    suspend fun activities(days: Int): Result<List<Activity>>
    suspend fun weeklyVolume(weeks: Int): Result<List<WeekValue>>
    suspend fun weeklyAvgHr(weeks: Int): Result<List<WeekValue>>
    suspend fun weeklyIntensity(): Result<WeeklyIntensity>
}

class DefaultActivityRepository @Inject constructor(private val api: BactaApi) : ActivityRepository {
    override suspend fun activities(days: Int): Result<List<Activity>> =
        resultOf { api.activities(days).activities.mapNotNull(ActivityDto::toDomain) }

    override suspend fun weeklyVolume(weeks: Int): Result<List<WeekValue>> =
        resultOf { api.weeklyVolume(weeks).weeks.mapNotNull { w -> w.hours?.let { WeekValue(w.week, it) } } }

    override suspend fun weeklyAvgHr(weeks: Int): Result<List<WeekValue>> =
        resultOf { api.weeklyAvgHr(weeks).weeks.mapNotNull { w -> w.avgHr?.let { WeekValue(w.week, it) } } }

    override suspend fun weeklyIntensity(): Result<WeeklyIntensity> =
        resultOf { api.weeklyIntensity().let { WeeklyIntensity(it.moderate, it.vigorous) } }
}

private val StartFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

/** A row whose start time cannot be read is dropped: showing it with a made-up time would be worse than omitting it. */
private fun ActivityDto.toDomain(): Activity? {
    val start = runCatching { LocalDateTime.parse(startTime, StartFormat) }.getOrNull() ?: return null
    return Activity(
        id = activityId.content,
        typeKey = typeKey,
        name = name?.takeIf { it.isNotBlank() },
        start = start,
        durationSeconds = durationS,
        distanceMeters = distanceM,
        avgHr = avgHr?.toInt(),
        calories = calories?.toInt(),
    )
}
