package io.github.bridgemouse.bacta.ui.briefing

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.data.repository.Briefing
import io.github.bridgemouse.bacta.domain.Freshness
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingContent
import io.github.bridgemouse.bacta.ui.designsystem.components.BriefingState
import io.github.bridgemouse.bacta.ui.format.Formatters
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** Network failures are "offline" (the last good briefing is kept); anything else is an error. */
fun briefingState(result: Result<Briefing?>, last: Briefing?, clock: Clock, fmt: Formatters): BriefingState {
    val now = clock.instant()
    return result.fold(
        onSuccess = { briefing ->
            when {
                briefing == null -> BriefingState.NoBriefing
                Freshness.of(briefing.generatedAt, now) == Freshness.Fresh ->
                    BriefingState.Live(briefing.toContent(), fmt.dateTime(briefing.generatedAt, clock.zone))
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

private fun age(at: Instant, now: Instant): UiText {
    val hours = Duration.between(at, now).toHours()
    return if (hours < 48) UiText.of(R.string.age_hours, hours.toInt()) else UiText.of(R.string.age_days, (hours / 24).toInt())
}
