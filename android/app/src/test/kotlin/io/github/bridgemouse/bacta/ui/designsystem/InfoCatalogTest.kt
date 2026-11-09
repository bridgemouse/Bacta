package io.github.bridgemouse.bacta.ui.designsystem

import io.github.bridgemouse.bacta.TestStrings
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.components.InfoCatalog
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

class InfoCatalogTest {
    @Test
    fun everyExplanationHasATitleAndABody() {
        assertTrue(InfoCatalog.all.size >= 15, "expected the catalog to cover the screens' cards")
        InfoCatalog.all.forEach { info ->
            assertTrue(TestStrings.resolve(UiText.of(info.title)).isNotBlank())
            assertTrue(TestStrings.resolve(UiText.of(info.body)).length > 20, "body too short for ${info.title}")
        }
    }

    @Test
    fun titlesAreUniqueSoTwoCardsNeverShareAnExplanation() {
        val titles = InfoCatalog.all.map { TestStrings.resolve(UiText.of(it.title)) }
        assertEquals(titles.size, titles.toSet().size)
    }

    @Test
    fun theLoadRatioExplanationStatesGarminsZone() {
        val body = TestStrings.resolve(UiText.of(InfoCatalog.LoadRatio.body))
        assertTrue("0.8" in body && "1.5" in body, body)
    }
}
