package io.github.bridgemouse.bacta.ui

import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.domain.Section

/** The display name of a section as a resource, so it can be translated; the domain enum only carries a stable key. */
fun Section.title(): UiText = UiText.of(
    when (this) {
        Section.Home -> R.string.section_home
        Section.Recovery -> R.string.section_recovery
        Section.Training -> R.string.section_training
        Section.Sleep -> R.string.section_sleep
    },
)
