package io.github.bridgemouse.bacta.ui.navigation

import io.github.bridgemouse.bacta.domain.Section
import kotlin.test.assertEquals
import org.junit.Test

class NavigationTest {
    @Test
    fun openingASectionKeepsHomeUnderneath() {
        val stack = mutableListOf<Destination>(Destination.Home)
        stack.openSection(Section.Recovery)
        assertEquals(listOf<Destination>(Destination.Home, Destination.Recovery), stack)
    }

    @Test
    fun openingTheSameSectionTwiceDoesNotStack() {
        val stack = mutableListOf<Destination>(Destination.Home)
        stack.openSection(Section.Recovery)
        stack.openSection(Section.Recovery)
        assertEquals(listOf<Destination>(Destination.Home, Destination.Recovery), stack)
    }

    @Test
    fun openingHomeClearsTheStack() {
        val stack = mutableListOf<Destination>(Destination.Home, Destination.Recovery)
        stack.openSection(Section.Home)
        assertEquals(listOf<Destination>(Destination.Home), stack)
    }

    @Test
    fun loginRequiredReplacesTheWholeStackAndIsIdempotent() {
        val stack = mutableListOf<Destination>(Destination.Home, Destination.Recovery)
        stack.reconcileLogin(loginRequired = true)
        stack.reconcileLogin(loginRequired = true)
        assertEquals(listOf<Destination>(Destination.Login), stack)
    }

    @Test
    fun loginNoLongerRequiredLeavesLoginForHome() {
        val stack = mutableListOf<Destination>(Destination.Login)
        stack.reconcileLogin(loginRequired = false)
        assertEquals(listOf<Destination>(Destination.Home), stack)
    }

    @Test
    fun loginNotRequiredLeavesOtherStacksAlone() {
        val stack = mutableListOf<Destination>(Destination.Home, Destination.Recovery)
        stack.reconcileLogin(loginRequired = false)
        assertEquals(listOf<Destination>(Destination.Home, Destination.Recovery), stack)
    }
}
