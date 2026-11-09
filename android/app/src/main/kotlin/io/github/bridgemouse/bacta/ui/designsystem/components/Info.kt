package io.github.bridgemouse.bacta.ui.designsystem.components

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.bridgemouse.bacta.R
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.textSecondary

/** What a card means, in two string resources. */
data class InfoText(@StringRes val title: Int, @StringRes val body: Int)

/** Every explanation the screens offer. Explanations of Garmin figures state Garmin's own bands; the architecture score says it is the app's own. */
object InfoCatalog {
    val RecoveryScore = InfoText(R.string.info_recovery_score_title, R.string.info_recovery_score_body)
    val Hrv = InfoText(R.string.info_hrv_title, R.string.info_hrv_body)
    val BodyBattery = InfoText(R.string.info_body_battery_title, R.string.info_body_battery_body)
    val RecoveryTime = InfoText(R.string.info_recovery_time_title, R.string.info_recovery_time_body)
    val RestingHr = InfoText(R.string.info_resting_hr_title, R.string.info_resting_hr_body)
    val Stress = InfoText(R.string.info_stress_title, R.string.info_stress_body)
    val SleepStress = InfoText(R.string.info_sleep_stress_title, R.string.info_sleep_stress_body)
    val Respiration = InfoText(R.string.info_respiration_title, R.string.info_respiration_body)
    val Spo2 = InfoText(R.string.info_spo2_title, R.string.info_spo2_body)
    val SleepHr = InfoText(R.string.info_sleep_hr_title, R.string.info_sleep_hr_body)
    val SleepScore = InfoText(R.string.info_sleep_score_title, R.string.info_sleep_score_body)
    val SleepEfficiency = InfoText(R.string.info_sleep_efficiency_title, R.string.info_sleep_efficiency_body)
    val SleepDebt = InfoText(R.string.info_sleep_debt_title, R.string.info_sleep_debt_body)
    val Architecture = InfoText(R.string.info_architecture_title, R.string.info_architecture_body)
    val TrainingStatus = InfoText(R.string.info_training_status_title, R.string.info_training_status_body)
    val AcuteLoad = InfoText(R.string.info_acute_load_title, R.string.info_acute_load_body)
    val LoadRatio = InfoText(R.string.info_load_ratio_title, R.string.info_load_ratio_body)
    val Intensity = InfoText(R.string.info_intensity_title, R.string.info_intensity_body)
    val Zones = InfoText(R.string.info_zones_title, R.string.info_zones_body)
    val Steps = InfoText(R.string.info_steps_title, R.string.info_steps_body)

    val all: List<InfoText> = listOf(
        RecoveryScore, Hrv, BodyBattery, RecoveryTime, RestingHr, Stress, SleepStress, Respiration, Spo2, SleepHr,
        SleepScore, SleepEfficiency, SleepDebt, Architecture, TrainingStatus, AcuteLoad, LoadRatio, Intensity, Zones, Steps,
    )
}

/** Which explanation is open, if any; one per screen. */
@Stable
class InfoState {
    var shown: InfoText? by mutableStateOf(null)
        private set

    fun show(info: InfoText) {
        shown = info
    }

    fun dismiss() {
        shown = null
    }
}

@Composable
fun rememberInfoState(): InfoState = remember { InfoState() }

/** Makes a whole card open its explanation when tapped, announced to TalkBack as a button that shows details. */
@Composable
fun Modifier.explains(info: InfoText, state: InfoState): Modifier =
    clickable(onClickLabel = stringResource(R.string.cd_show_details), role = Role.Button) { state.show(info) }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoSheet(state: InfoState) {
    val info = state.shown ?: return
    ModalBottomSheet(
        onDismissRequest = state::dismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = BactaPalette.Surface,
    ) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 24.dp)) {
            Text(stringResource(info.title), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, color = BactaPalette.Text)
            Text(
                stringResource(info.body),
                Modifier.padding(top = 10.dp),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.textSecondary,
            )
        }
    }
}
