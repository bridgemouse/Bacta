package io.github.bridgemouse.bacta.ui.gates

import io.github.bridgemouse.bacta.ui.UiText
import io.github.bridgemouse.bacta.R
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.github.bridgemouse.bacta.localNetworkPermissionRequired
import io.github.bridgemouse.bacta.ui.navigation.PermissionState

class LocalNetworkPermission(val state: PermissionState, val request: () -> Unit)

/** Asks once on first launch, and re-checks on resume so granting it from system settings takes effect without a restart. */
@Composable
fun rememberLocalNetworkPermission(): LocalNetworkPermission {
    val context = LocalContext.current
    val required = remember { localNetworkPermissionRequired(Build.VERSION.SDK_INT) }
    fun check() = !required || context.checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) == PackageManager.PERMISSION_GRANTED

    var granted by remember { mutableStateOf(check()) }
    var asked by rememberSaveable { mutableStateOf(false) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { granted = check() }
    LaunchedEffect(Unit) {
        if (!granted && !asked) {
            asked = true
            launcher.launch(Manifest.permission.ACCESS_LOCAL_NETWORK)
        }
    }
    return LocalNetworkPermission(
        state = if (granted) PermissionState.Granted else PermissionState.Missing,
        request = { launcher.launch(Manifest.permission.ACCESS_LOCAL_NETWORK) },
    )
}

@Composable
fun LocalNetworkRequiredScreen(onRequest: () -> Unit) {
    val context = LocalContext.current
    GateScreen(
        title = UiText.of(R.string.gate_local_network_title),
        message = UiText.of(R.string.gate_local_network_body),
    ) {
        GateButton(UiText.of(R.string.action_allow), onRequest)
        GateButton(UiText.of(R.string.action_open_settings)) {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
            )
        }
    }
}
