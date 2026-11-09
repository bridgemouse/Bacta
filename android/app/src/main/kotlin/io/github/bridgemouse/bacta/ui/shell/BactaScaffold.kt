package io.github.bridgemouse.bacta.ui.shell

import io.github.bridgemouse.bacta.ui.title
import io.github.bridgemouse.bacta.ui.asString
import androidx.compose.ui.res.stringResource
import io.github.bridgemouse.bacta.R
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import io.github.bridgemouse.bacta.ui.designsystem.viz.StatusDot
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.domain.Section
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.bactaTexture
import io.github.bridgemouse.bacta.ui.designsystem.viz.MX4Sigil
import io.github.bridgemouse.bacta.ui.designsystem.viz.SigilMood

private val ContentMaxWidth = 640.dp

/**
 * The frame every section sits in: status bar, content, dock. Insets are applied to the bars, not the content,
 * so scrolling content runs behind the system bars edge to edge. The content column is capped for the unfolded Fold.
 */
@Composable
fun BactaScaffold(
    section: Section,
    tabs: Boolean,
    tabState: SectionTabState,
    onBack: () -> Unit,
    onOpenSection: (Section) -> Unit,
    onOpenSecondary: (io.github.bridgemouse.bacta.ui.navigation.Destination) -> Unit,
    status: StatusBarState = StatusBarState(),
    onSync: () -> Unit = {},
    content: @Composable () -> Unit,
) {
    var sheetOpen by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(BactaPalette.Base).bactaTexture(BactaPalette.accent(section))) {
        TopBar(section, onBack, status, onSync)
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Box(Modifier.widthIn(max = ContentMaxWidth).fillMaxSize()) { content() }
        }
        Dock(tabs = tabs, tabState = tabState, onNav = { sheetOpen = true })
    }
    if (sheetOpen) {
        NavSheet(
            current = section,
            onSelect = { sheetOpen = false; onOpenSection(it) },
            onSelectSecondary = { sheetOpen = false; onOpenSecondary(it) },
            onDismiss = { sheetOpen = false },
        )
    }
}

/** The frame for screens that are not one of the four sections: a back chevron and a title, no dock. */
@Composable
fun BactaSecondaryScaffold(title: io.github.bridgemouse.bacta.ui.UiText, onBack: () -> Unit, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(BactaPalette.Base).bactaTexture(BactaPalette.Mx4)) {
        Row(
            Modifier.fillMaxWidth().background(BactaPalette.Surface).statusBarsPadding().height(52.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BackChevron(onBack)
            Text(
                title.asString().uppercase(),
                style = MaterialTheme.typography.titleMedium,
                color = BactaPalette.Mx4,
                modifier = Modifier.padding(start = 10.dp).semantics { heading() },
            )
        }
        Box(Modifier.weight(1f).fillMaxWidth().navigationBarsPadding(), contentAlignment = Alignment.TopCenter) {
            Box(Modifier.widthIn(max = ContentMaxWidth).fillMaxSize()) { content() }
        }
    }
}

@Composable
private fun TopBar(section: Section, onBack: () -> Unit, status: StatusBarState, onSync: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(BactaPalette.Surface).statusBarsPadding().height(52.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (section == Section.Home) {
            Text(
                stringResource(R.string.brand),
                style = MaterialTheme.typography.titleMedium,
                color = BactaPalette.Mx4,
                modifier = Modifier.padding(start = 8.dp).semantics { heading() },
            )
        } else {
            BackChevron(onBack)
            MX4Sigil(if (section == Section.Recovery) SigilMood.Pleased else SigilMood.Transmit, 22.dp)
            Text(
                section.title().asString().uppercase(),
                style = MaterialTheme.typography.titleMedium,
                color = BactaPalette.accent(section),
                modifier = Modifier.padding(start = 10.dp).semantics { heading() },
            )
        }
        Spacer(Modifier.weight(1f))
        SyncButton(status.sync, onSync)
        Mx4StatusLabel(status.mx4)
        if (section == Section.Home) MX4Sigil(SigilMood.Idle, 22.dp, Modifier.padding(start = 6.dp, end = 8.dp))
    }
}

/** The Garmin sync control: idle shows SYNC, running shows the seconds, and the result stays for a moment. Only the server's real state is shown. */
@Composable
private fun SyncButton(sync: SyncUi, onSync: () -> Unit) {
    val label = when (sync) {
        SyncUi.Idle -> stringResource(R.string.sync_label)
        is SyncUi.Running -> stringResource(R.string.sync_running, sync.elapsedSeconds)
        SyncUi.Done -> stringResource(R.string.sync_done)
        SyncUi.Failed -> stringResource(R.string.sync_failed)
    }
    val color = when (sync) {
        SyncUi.Done -> BactaPalette.Positive
        SyncUi.Failed -> BactaPalette.Flag
        else -> BactaPalette.Mx4
    }
    val running = sync is SyncUi.Running
    val description = stringResource(R.string.cd_sync, label)
    Box(
        Modifier
            .heightIn(min = 48.dp)
            .clip(CircleShape)
            .clickable(enabled = !running, role = Role.Button, onClick = onSync)
            .semantics { contentDescription = description }
            .padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            Modifier
                .border(1.dp, color.copy(alpha = if (running || sync != SyncUi.Idle) 0.6f else 0.35f), RoundedCornerShape(6.dp))
                .padding(horizontal = 9.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            maxLines = 1,
            softWrap = false,
        )
    }
}

/** MX-4's state from his last briefing; hidden when the server did not answer, since nothing is known. */
@Composable
private fun Mx4StatusLabel(status: Mx4Status) {
    val (label, color) = when (status) {
        Mx4Status.Unknown -> return
        Mx4Status.Online -> R.string.mx4_online to BactaPalette.Positive
        Mx4Status.Stale -> R.string.mx4_stale to BactaPalette.Caution
        Mx4Status.NoBriefing -> R.string.mx4_not_run to BactaPalette.TextMuted
    }
    Row(Modifier.padding(start = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        StatusDot(color, Modifier)
        Text(stringResource(label), Modifier.padding(start = 5.dp), style = MaterialTheme.typography.labelSmall, color = color, maxLines = 1, softWrap = false)
    }
}

@Composable
private fun BackChevron(onBack: () -> Unit) {
    val backLabel = stringResource(R.string.action_back)
    Box(
        Modifier
            .size(48.dp)
            .clip(CircleShape)
            .clickable(onClick = onBack)
            .semantics { role = Role.Button; contentDescription = backLabel },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(20.dp)) {
            val stroke = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
            drawLine(BactaPalette.Text, Offset(size.width * 0.65f, size.height * 0.15f), Offset(size.width * 0.3f, size.height * 0.5f), stroke.width, stroke.cap)
            drawLine(BactaPalette.Text, Offset(size.width * 0.3f, size.height * 0.5f), Offset(size.width * 0.65f, size.height * 0.85f), stroke.width, stroke.cap)
        }
    }
}

@Composable
private fun Dock(tabs: Boolean, tabState: SectionTabState, onNav: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(BactaPalette.Surface).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AskDockButton()
        if (tabs) TabToggle(tabState)
        NavButton(onNav)
    }
}

@Composable
private fun TabToggle(tabState: SectionTabState) {
    SingleChoiceSegmentedButtonRow {
        Tab.entries.forEachIndexed { index, tab ->
            SegmentedButton(
                selected = tabState.tab == tab,
                onClick = { tabState.tab = tab },
                shape = SegmentedButtonDefaults.itemShape(index, Tab.entries.size),
                colors = SegmentedButtonDefaults.colors(
                    activeContainerColor = BactaPalette.Mx4.copy(alpha = 0.18f),
                    activeContentColor = BactaPalette.Mx4,
                    activeBorderColor = BactaPalette.Mx4,
                    inactiveContainerColor = Color.Transparent,
                    inactiveContentColor = BactaPalette.TextSecondary,
                    inactiveBorderColor = BactaPalette.Line,
                ),
                label = { Text(stringResource(if (tab == Tab.Overview) R.string.tab_overview else R.string.tab_trends), style = MaterialTheme.typography.labelMedium) },
            )
        }
    }
}

@Composable
private fun NavButton(onClick: () -> Unit) {
    val navLabel = stringResource(R.string.cd_all_systems)
    Box(
        Modifier
            .size(48.dp)
            .clip(CircleShape)
            .border(1.dp, BactaPalette.Mx4, CircleShape)
            .clickable(onClick = onClick)
            .semantics { role = Role.Button; contentDescription = navLabel },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(18.dp)) {
            val w = 2.dp.toPx()
            listOf(0.2f, 0.5f, 0.8f).forEach { y ->
                drawLine(BactaPalette.Mx4, Offset(0f, size.height * y), Offset(size.width, size.height * y), w, StrokeCap.Round)
            }
        }
    }
}
