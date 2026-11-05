package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.domain.Hypnogram
import io.github.bridgemouse.bacta.domain.SleepStage
import javax.inject.Inject

/** The night resampled into equal blocks, with Garmin's local-as-UTC start and end in milliseconds. */
data class NightHypnogram(val levels: List<SleepStage?>, val startLocalMs: Long?, val endLocalMs: Long?)

interface SleepRepository {
    /** `null` means the server had no usable hypnogram for the latest night; nothing is substituted. */
    suspend fun hypnogram(): Result<NightHypnogram?>
}

class DefaultSleepRepository @Inject constructor(private val api: BactaApi) : SleepRepository {
    override suspend fun hypnogram(): Result<NightHypnogram?> = resultOf {
        val dto = api.sleepHypno()
        if (dto.hypno.size != BLOCKS) return@resultOf null
        val levels = dto.hypno.map(Hypnogram::stage)
        if (levels.all { it == null }) null else NightHypnogram(levels, dto.startLocal, dto.endLocal)
    }

    private companion object {
        const val BLOCKS = 24
    }
}
