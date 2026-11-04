package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** A section's scrolling column of cards with pull-to-refresh; the spacing matches the web's 13dp page padding and 9dp gaps. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RefreshableScroll(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    PullToRefreshBox(isRefreshing = refreshing, onRefresh = onRefresh, modifier = modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
            content = content,
        )
    }
}
