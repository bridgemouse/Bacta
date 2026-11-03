package io.github.bridgemouse.bacta.ui.designsystem

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TypeTest {
    @Test
    fun proseUsesHankenGroteskAndNumbersAndLabelsUseJetBrainsMono() {
        val t = bactaTypography
        assertEquals(HankenGrotesk, t.bodyLarge.fontFamily)
        assertEquals(HankenGrotesk, t.headlineMedium.fontFamily)
        assertEquals(JetBrainsMono, t.labelSmall.fontFamily)
        assertEquals(JetBrainsMono, t.displayMedium.fontFamily)
    }

    @Test
    fun noTextStyleIsSmallerThanElevenSp() {
        val t = bactaTypography
        val all = listOf(
            t.displayLarge, t.displayMedium, t.displaySmall,
            t.headlineLarge, t.headlineMedium, t.headlineSmall,
            t.titleLarge, t.titleMedium, t.titleSmall,
            t.bodyLarge, t.bodyMedium, t.bodySmall,
            t.labelLarge, t.labelMedium, t.labelSmall,
        )
        all.forEach { assertTrue("${it.fontSize} is below 11sp", it.fontSize.value >= 11f) }
    }
}
