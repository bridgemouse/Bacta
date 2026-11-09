package io.github.bridgemouse.bacta.ui.designsystem.components

import io.github.bridgemouse.bacta.ui.UiText
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.ui.asString
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.semantics.heading
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.foundation.layout.FlowRow
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
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun BriefingCard(
    model: BriefingModel,
    modifier: Modifier = Modifier,
    onRefresh: (() -> Unit)? = null,
    initiallyExpanded: Boolean = false,
) {
    val accent = BactaPalette.Mx4
    val secondary = MaterialTheme.colorScheme.textSecondary
    val state0 = model.state
    val shown = (state0 as? BriefingState.Live)?.content ?: (state0 as? BriefingState.Stale)?.content ?: (state0 as? BriefingState.Offline)?.last
    var expanded by rememberSaveable { mutableStateOf(initiallyExpanded) }
    Column(modifier.fullWidth(), verticalArrangement = Arrangement.spacedBy(9.dp)) {
    BactaCard(accent = accent, size = CardSize.Bar) {
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
                content?.let { BriefingBody(it, expanded) }
            }
        }
        val hasBody = shown?.body != null
        if (onRefresh != null || hasBody) {
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (onRefresh != null) {
                    TextButton(onClick = onRefresh, modifier = Modifier.heightIn(min = 48.dp)) {
                        Text(stringResource(R.string.action_refresh), style = MaterialTheme.typography.labelMedium, color = accent)
                    }
                }
                Spacer(Modifier.weight(1f))
                if (hasBody) {
                    val open = stringResource(if (expanded) R.string.briefing_hide_analysis else R.string.briefing_full_analysis)
                    TextButton(
                        onClick = { expanded = !expanded },
                        modifier = Modifier.heightIn(min = 48.dp),
                    ) {
                        Text(open, style = MaterialTheme.typography.labelMedium, color = accent)
                    }
                }
            }
        }
    }
    shown?.flags?.takeIf { it.isNotEmpty() }?.let { flags ->
        val tone = BactaPalette.tone(shown.tone)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            flags.forEach { Chip(UiText.Literal(it.uppercase()), tone) }
        }
    }
    }
}

@Composable
private fun BriefingBody(content: BriefingContent, expanded: Boolean) {
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
    if (expanded && content.body != null) {
        Spacer(Modifier.height(12.dp))
        androidx.compose.material3.HorizontalDivider(color = BactaPalette.Line)
        Spacer(Modifier.height(10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            markdownBlocks(content.body).forEach { block ->
                when (block) {
                    is MarkdownBlock.Heading -> Text(
                        block.text.uppercase(),
                        Modifier.padding(top = 4.dp).semantics { heading() },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (block.level == 2) accent else MaterialTheme.colorScheme.textSecondary,
                    )
                    is MarkdownBlock.Bullet -> Row {
                        Text(stringResource(R.string.bullet), Modifier.padding(end = 8.dp), style = MaterialTheme.typography.bodyMedium, color = accent)
                        Text(inlineMarkdown(block.text), style = MaterialTheme.typography.bodyMedium, color = BactaPalette.Text)
                    }
                    is MarkdownBlock.Paragraph -> Text(inlineMarkdown(block.text), style = MaterialTheme.typography.bodyMedium, color = BactaPalette.Text)
                }
            }
        }
    }
}
