package io.github.bridgemouse.bacta.domain

import java.time.Duration
import java.time.Instant

enum class Freshness {
    Fresh, Stale;

    companion object {
        private val STALE_AFTER = Duration.ofHours(36)

        fun of(generatedAt: Instant, now: Instant): Freshness =
            if (Duration.between(generatedAt, now) > STALE_AFTER) Stale else Fresh
    }
}
