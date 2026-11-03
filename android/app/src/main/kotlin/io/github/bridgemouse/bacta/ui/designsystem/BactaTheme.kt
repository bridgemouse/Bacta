package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val bactaColorScheme: ColorScheme = darkColorScheme(
    primary = BactaPalette.Mx4,
    onPrimary = BactaPalette.Base,
    background = BactaPalette.Base,
    onBackground = BactaPalette.Text,
    surface = BactaPalette.Surface,
    onSurface = BactaPalette.Text,
    surfaceVariant = BactaPalette.SurfaceElevated,
    onSurfaceVariant = BactaPalette.TextSecondary,
    surfaceContainerLowest = BactaPalette.Base,
    surfaceContainerLow = BactaPalette.Surface,
    surfaceContainer = BactaPalette.Surface,
    surfaceContainerHigh = BactaPalette.SurfaceElevated,
    surfaceContainerHighest = BactaPalette.SurfaceElevated,
    outline = BactaPalette.Line,
    outlineVariant = BactaPalette.Line,
    error = BactaPalette.Flag,
    onError = BactaPalette.Base,
)

// Values Material has no role for; the same in every theme, so plain extensions (Google's
// "Extend Material theming" guidance) rather than a CompositionLocal.
val ColorScheme.textSecondary: Color get() = BactaPalette.TextSecondary
val ColorScheme.textMuted: Color get() = BactaPalette.TextMuted
val ColorScheme.mx4: Color get() = BactaPalette.Mx4
val ColorScheme.positive: Color get() = BactaPalette.Positive
val ColorScheme.caution: Color get() = BactaPalette.Caution
val ColorScheme.flag: Color get() = BactaPalette.Flag

@Composable
fun BactaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = bactaColorScheme,
        typography = bactaTypography,
        shapes = bactaShapes,
        content = content,
    )
}
