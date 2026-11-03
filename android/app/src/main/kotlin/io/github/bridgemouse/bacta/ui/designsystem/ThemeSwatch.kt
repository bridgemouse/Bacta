package io.github.bridgemouse.bacta.ui.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section

@Composable
private fun Swatch(name: String, color: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier
                .size(44.dp)
                .background(color, RoundedCornerShape(8.dp))
                .border(1.dp, BactaPalette.Line, RoundedCornerShape(8.dp)),
        )
        Text(name, style = MaterialTheme.typography.labelSmall, color = BactaPalette.TextSecondary)
    }
}

@Preview(widthDp = 412, heightDp = 760, showBackground = true, backgroundColor = 0xFF0F1117)
@Composable
fun ThemeSwatch() {
    BactaTheme {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .bactaTexture(BactaPalette.Mx4)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("BACTA·OS", style = MaterialTheme.typography.displaySmall, color = BactaPalette.Mx4)
            Text(
                "MX-4 narrative text is set in Hanken Grotesk.",
                style = MaterialTheme.typography.bodyLarge,
                color = BactaPalette.Text,
            )
            Text("READINESS · SYNTHESIZED", style = MaterialTheme.typography.labelSmall, color = BactaPalette.TextSecondary)
            Text("74  0123456789  7.46h", style = MaterialTheme.typography.displayMedium, color = BactaPalette.Text)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Swatch("base", BactaPalette.Base)
                Swatch("surface", BactaPalette.Surface)
                Swatch("elev", BactaPalette.SurfaceElevated)
                Swatch("line", BactaPalette.Line)
                Swatch("muted", BactaPalette.TextMuted)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Section.entries.forEach { Swatch(it.key, BactaPalette.accent(it)) }
                Swatch("pos", BactaPalette.Positive)
                Swatch("warn", BactaPalette.Caution)
                Swatch("flag", BactaPalette.Flag)
            }
        }
    }
}
