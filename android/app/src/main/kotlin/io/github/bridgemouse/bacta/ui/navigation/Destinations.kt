package io.github.bridgemouse.bacta.ui.navigation

import androidx.navigation3.runtime.NavKey
import io.github.bridgemouse.bacta.domain.Section
import kotlinx.serialization.Serializable

@Serializable
sealed interface Destination : NavKey {
    @Serializable data object Login : Destination
    @Serializable data object Home : Destination
    @Serializable data object Recovery : Destination
    @Serializable data object Sleep : Destination
    @Serializable data object Training : Destination
    @Serializable data object Settings : Destination
    @Serializable data object Logs : Destination
    @Serializable data object About : Destination
}

/** Sections that have a screen; the nav sheet lists only these. */
val BuiltSections: List<Section> = listOf(Section.Home, Section.Recovery, Section.Sleep, Section.Training)

fun Destination.section(): Section? = when (this) {
    Destination.Login -> null
    Destination.Home -> Section.Home
    Destination.Recovery -> Section.Recovery
    Destination.Sleep -> Section.Sleep
    Destination.Training -> Section.Training
    Destination.Settings, Destination.Logs, Destination.About -> null
}

private fun Section.destination(): Destination? = when (this) {
    Section.Home -> Destination.Home
    Section.Recovery -> Destination.Recovery
    Section.Sleep -> Destination.Sleep
    Section.Training -> Destination.Training
    else -> null
}

/** Screens outside the four sections, reached from the navigation sheet. */
val SecondaryDestinations: List<Pair<Destination, Int>> = listOf(
    Destination.Settings to io.github.bridgemouse.bacta.R.string.settings_title,
    Destination.Logs to io.github.bridgemouse.bacta.R.string.logs_title,
    Destination.About to io.github.bridgemouse.bacta.R.string.about_title,
)

/** Like [openSection]: Home stays underneath so back lands there. */
fun MutableList<Destination>.openSecondary(target: Destination) {
    if (lastOrNull() == target) return
    clear()
    add(Destination.Home)
    add(target)
}

/** Home is always the bottom of the stack, so back from a section lands on Home and back from Home leaves the app. */
fun MutableList<Destination>.openSection(section: Section) {
    val target = section.destination() ?: return
    if (lastOrNull() == target) return
    clear()
    add(Destination.Home)
    if (target != Destination.Home) add(target)
}

/** Conditional navigation driven by state: while login is required nothing else is reachable; once it is not, Login is left for Home. */
fun MutableList<Destination>.reconcileLogin(loginRequired: Boolean) {
    if (loginRequired) {
        if (this != listOf(Destination.Login)) {
            clear()
            add(Destination.Login)
        }
    } else if (lastOrNull() == Destination.Login) {
        clear()
        add(Destination.Home)
    }
}
