package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.UiText
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.domain.Tone
import io.github.bridgemouse.bacta.ui.designsystem.CardSize
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary
import io.github.bridgemouse.bacta.ui.designsystem.viz.Chip
import io.github.bridgemouse.bacta.ui.designsystem.viz.MX4Sigil
import io.github.bridgemouse.bacta.ui.designsystem.viz.SigilMood

private fun Tone.chipText(): UiText = when (this) {
    Tone.Positive -> UiText.of(R.string.tone_positive)
    Tone.Caution -> UiText.of(R.string.tone_caution)
    Tone.Flag -> UiText.of(R.string.tone_flag)
}

/** MX-4's briefing. Every state is explicit: a server stub or a failed run is never shown as MX-4 speaking. */
@Composable
fun BriefingCard(
    model: BriefingModel,
    modifier: Modifier = Modifier,
    onRefresh: (() -> Unit)? = null,
) {
    val accent = BactaPalette.Mx4
    val secondary = MaterialTheme.colorScheme.textSecondary
    BactaCard(accent = accent, modifier = modifier, size = CardSize.Bar) {
        val state = model.state
        val live = state as? BriefingState.Live
        val stale = state as? BriefingState.Stale
        val content = live?.content ?: stale?.content ?: (state as? BriefingState.Offline)?.last
        val stamp = live?.timestamp ?: stale?.age ?: (state as? BriefingState.Offline)?.age
        Row(verticalAlignment = Alignment.CenterVertically) {
            MX4Sigil(if (state is BriefingState.Loading) SigilMood.Think else SigilMood.Idle, 24.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.briefing_title, model.title.asString().uppercase()), style = MaterialTheme.typography.labelMedium, color = accent)
                stamp?.let { Text(it.asString(), style = MaterialTheme.typography.labelSmall, color = secondary) }
            }
            when {
                live != null -> Chip(live.content.tone.chipText(), BactaPalette.tone(live.content.tone))
                stale != null -> Chip(UiText.of(R.string.briefing_stale), BactaPalette.Caution)
                state is BriefingState.Offline -> Chip(UiText.of(R.string.briefing_offline), BactaPalette.Flag)
            }
        }
        Spacer(Modifier.height(10.dp))
        when (state) {
            BriefingState.Loading -> {
                Text(stringResource(R.string.briefing_loading), style = MaterialTheme.typography.bodyMedium, color = secondary)
                Spacer(Modifier.height(8.dp))
                Spacer(Modifier.fillMaxWidth().height(10.dp).background(BactaPalette.Line, RoundedCornerShape(5.dp)))
                Spacer(Modifier.height(6.dp))
                Spacer(Modifier.fillMaxWidth(0.7f).height(10.dp).background(BactaPalette.Line, RoundedCornerShape(5.dp)))
            }
            BriefingState.NoBriefing ->
                Text(stringResource(R.string.briefing_none), style = MaterialTheme.typography.bodyMedium, color = secondary)
            BriefingState.Error ->
                Text(stringResource(R.string.briefing_error), Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = MaterialTheme.typography.bodyMedium, color = BactaPalette.Flag)
            else -> {
                if (state is BriefingState.Offline) {
                    Text(
                        stringResource(if (content != null) R.string.briefing_offline_last else R.string.briefing_offline_none),
                        style = MaterialTheme.typography.bodyMedium,
                        color = BactaPalette.Flag,
                    )
                    Spacer(Modifier.height(8.dp))
                }
                content?.let { BriefingBody(it) }
            }
        }
        if (onRefresh != null) {
            Spacer(Modifier.height(4.dp))
            TextButton(onClick = onRefresh, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(stringResource(R.string.action_refresh), style = MaterialTheme.typography.labelMedium, color = accent)
            }
        }
    }
}

@Composable
private fun BriefingBody(content: BriefingContent) {
    val accent = BactaPalette.Mx4
    Text(inlineMarkdown(content.headline), style = MaterialTheme.typography.labelMedium, color = accent)
    content.summary?.let {
        Spacer(Modifier.height(6.dp))
        Text(inlineMarkdown(it), style = MaterialTheme.typography.bodyLarge, color = BactaPalette.Text)
    }
    content.directive?.let {
        Spacer(Modifier.height(10.dp))
        // One text run, label inline: wrapped lines flow under the label instead of leaving an empty column beside it.
        val labelStyle = MaterialTheme.typography.labelSmall.toSpanStyle().copy(color = accent)
        val label = stringResource(R.string.briefing_directive)
        Text(
            buildAnnotatedString {
                withStyle(labelStyle) { append(label) }
                append("  ")
                append(inlineMarkdown(it))
            },
            Modifier.fillMaxWidth().background(BactaPalette.Base.copy(alpha = 0.5f), RoundedCornerShape(8.dp)).padding(12.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = BactaPalette.Text,
        )
    }
}
