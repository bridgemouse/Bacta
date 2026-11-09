package io.github.bridgemouse.bacta.ui.designsystem.viz

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.asString
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaDirection
import io.github.bridgemouse.bacta.ui.designsystem.components.DeltaModel
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier) {
    Spacer(modifier.size(8.dp).background(color, CircleShape))
}

@Composable
fun Chip(text: UiText, color: Color, modifier: Modifier = Modifier, wrap: Boolean = false) {
    Row(
        modifier
            .background(color.copy(alpha = 0.12f), RoundedCornerShape(6.dp))
            .border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusDot(color, Modifier.size(6.dp))
        Spacer(Modifier.width(6.dp))
        Text(text.asString(), style = MaterialTheme.typography.labelSmall, color = color, maxLines = if (wrap) Int.MAX_VALUE else 1, softWrap = wrap)
    }
}

@Composable
fun DeltaText(delta: DeltaModel, modifier: Modifier = Modifier) {
    val color = when (delta.direction) {
        DeltaDirection.Good -> BactaPalette.Positive
        DeltaDirection.Bad -> BactaPalette.Flag
        DeltaDirection.Flat -> MaterialTheme.colorScheme.textSecondary
    }
    Text(delta.text.asString(), modifier, style = MaterialTheme.typography.labelMedium, color = color)
}
