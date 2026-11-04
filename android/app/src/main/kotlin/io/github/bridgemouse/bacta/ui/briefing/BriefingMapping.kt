package io.github.bridgemouse.bacta.ui.briefing

import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.domain.Freshness
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

private val TimestampFormat = DateTimeFormatter.ofPattern("MMM d · HH:mm", Locale.US)

/** Network failures are "offline" (the last good briefing is kept); anything else is an error. */
fun briefingState(result: Result<Briefing?>, last: Briefing?, clock: Clock): BriefingState {
    val now = clock.instant()
    return result.fold(
        onSuccess = { briefing ->
            when {
                briefing == null -> BriefingState.NoBriefing
                Freshness.of(briefing.generatedAt, now) == Freshness.Fresh ->
                    BriefingState.Live(briefing.toContent(), timestamp(briefing.generatedAt, clock))
                else -> BriefingState.Stale(briefing.toContent(), age(briefing.generatedAt, now))
            }
        },
        onFailure = { error ->
            if (error is IOException) BriefingState.Offline(last?.toContent(), last?.let { age(it.generatedAt, now) })
            else BriefingState.Error
        },
    )
}

private fun Briefing.toContent() = BriefingContent(
    tone = tone,
    headline = headline,
    summary = (summary ?: body).takeUnless { it.isBlank() },
    directive = recommendation.takeUnless { it.isBlank() },
)

private fun timestamp(at: Instant, clock: Clock): String =
    TimestampFormat.format(at.atZone(clock.zone)).uppercase(Locale.US)

private fun age(at: Instant, now: Instant): String {
    val hours = Duration.between(at, now).toHours()
    return if (hours < 48) "${hours}h ago" else "${hours / 24}d ago"
}
