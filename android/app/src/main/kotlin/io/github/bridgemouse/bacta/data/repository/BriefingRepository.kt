package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.BriefingDto
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.domain.Tone
import java.time.Instant
import java.time.format.DateTimeParseException
import javax.inject.Inject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

interface BriefingRepository {
    /** A null briefing means the server only had its placeholder text, which is never shown as MX-4's words. */
    suspend fun briefing(section: Section): Result<Briefing?>
}

class DefaultBriefingRepository @Inject constructor(private val api: BactaApi) : BriefingRepository {
    override suspend fun briefing(section: Section): Result<Briefing?> =
        resultOf { api.briefing(section.key).toDomain() }
}

private fun BriefingDto.toDomain(): Briefing? {
    val generated = generatedAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
    return Briefing(
        tone = when (tone.uppercase()) {
            "POSITIVE" -> Tone.Positive
            "FLAG" -> Tone.Flag
            else -> Tone.Caution
        },
        headline = headline,
        summary = summary,
        body = body,
        recommendation = recommendation,
        flags = flags.mapNotNull { (it as? JsonPrimitive)?.contentOrNull },
        generatedAt = generated,
        model = model,
    )
}
