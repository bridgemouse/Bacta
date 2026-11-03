package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import io.github.bridgemouse.bacta.R

private fun variableFont(resId: Int, weight: Int) = Font(
    resId = resId,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val HankenGrotesk = FontFamily(
    variableFont(R.font.hankengrotesk_variable, 400),
    variableFont(R.font.hankengrotesk_variable, 500),
    variableFont(R.font.hankengrotesk_variable, 600),
    variableFont(R.font.hankengrotesk_variable, 700),
)

val JetBrainsMono = FontFamily(
    variableFont(R.font.jetbrainsmono_variable, 400),
    variableFont(R.font.jetbrainsmono_variable, 500),
    variableFont(R.font.jetbrainsmono_variable, 600),
    variableFont(R.font.jetbrainsmono_variable, 700),
)

private fun readout(size: Int, weight: FontWeight = FontWeight.Bold) = TextStyle(
    fontFamily = JetBrainsMono,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = (size * 1.15f).sp,
)

private fun prose(size: Int, weight: FontWeight, line: Float = 1.4f) = TextStyle(
    fontFamily = HankenGrotesk,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = (size * line).sp,
)

private fun label(size: Int, spacing: Float) = TextStyle(
    fontFamily = JetBrainsMono,
    fontWeight = FontWeight.SemiBold,
    fontSize = size.sp,
    lineHeight = (size * 1.35f).sp,
    letterSpacing = spacing.sp,
)

// Starting scale: numbers and labels in JetBrains Mono, narrative in Hanken Grotesk, nothing below 11sp.
val bactaTypography = Typography(
    displayLarge = readout(44),
    displayMedium = readout(32),
    displaySmall = readout(24),
    headlineLarge = prose(24, FontWeight.Bold, 1.2f),
    headlineMedium = prose(20, FontWeight.Bold, 1.25f),
    headlineSmall = prose(18, FontWeight.SemiBold, 1.25f),
    titleLarge = prose(16, FontWeight.SemiBold),
    titleMedium = prose(14, FontWeight.SemiBold),
    titleSmall = prose(13, FontWeight.SemiBold),
    bodyLarge = prose(15, FontWeight.Normal, 1.5f),
    bodyMedium = prose(14, FontWeight.Normal, 1.5f),
    bodySmall = prose(12, FontWeight.Normal, 1.45f),
    labelLarge = label(13, 0.8f),
    labelMedium = label(12, 1.0f),
    labelSmall = label(11, 1.2f),
)
