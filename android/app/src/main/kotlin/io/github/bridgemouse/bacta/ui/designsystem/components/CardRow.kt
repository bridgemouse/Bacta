package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Cards that sit side by side and share one height: the row is as tall as its tallest card, and each card stretches to it. */
@Composable
fun CardRow(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(9.dp), content = content)
}

/** The modifier for a card inside a [CardRow]: equal share of the width, full row height. */
fun RowScope.rowCard(): Modifier = Modifier.weight(1f).fillMaxHeight()
