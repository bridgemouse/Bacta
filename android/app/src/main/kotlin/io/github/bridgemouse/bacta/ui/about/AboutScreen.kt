package io.github.bridgemouse.bacta.ui.about

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.bridgemouse.bacta.BuildConfig
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.components.SettingRow
import io.github.bridgemouse.bacta.ui.designsystem.components.SettingsGroup

@Composable
fun AboutRoute(viewModel: AboutViewModel = hiltViewModel()) {
    val ui by viewModel.state.collectAsStateWithLifecycle()
    AboutScreen(BuildConfig.VERSION_NAME, ui)
}

@Composable
fun AboutScreen(appVersion: String, ui: AboutUiState, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(13.dp)) {
        SettingsGroup(UiText.of(R.string.about_title), BactaPalette.Mx4) {
            SettingRow(UiText.of(R.string.about_app_version), UiText.Literal(appVersion))
            SettingRow(
                UiText.of(R.string.about_server_version),
                ui.serverVersion?.let { UiText.Literal(it) } ?: UiText.of(if (ui.loaded) R.string.about_server_unknown else R.string.value_missing),
            )
        }
    }
}
