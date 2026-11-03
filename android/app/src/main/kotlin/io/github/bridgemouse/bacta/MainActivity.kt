package io.github.bridgemouse.bacta

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dagger.hilt.android.AndroidEntryPoint
import io.github.bridgemouse.bacta.ui.designsystem.BactaPalette
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.designsystem.JetBrainsMono

private val BASE_URLS = listOf("http://bacta.home", "http://192.168.1.119:3001")

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val transparent = android.graphics.Color.TRANSPARENT
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(transparent),
            navigationBarStyle = SystemBarStyle.dark(transparent),
        )
        setContent { BactaTheme { HelloScreen() } }
    }
}

@Composable
private fun HelloScreen() {
    val context = LocalContext.current
    val permissionRequired = localNetworkPermissionRequired(Build.VERSION.SDK_INT)
    var granted by remember {
        mutableStateOf(
            !permissionRequired ||
                context.checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    var status by remember { mutableStateOf("contacting server…") }

    LaunchedEffect(Unit) {
        if (!granted) launcher.launch(Manifest.permission.ACCESS_LOCAL_NETWORK)
    }

    LaunchedEffect(granted) {
        if (!granted) {
            status = "Local network access is needed to reach the Bacta server.\nAllow \"Nearby devices\" for Bacta in system settings."
            return@LaunchedEffect
        }
        status = "no server reachable"
        for (url in BASE_URLS) {
            val result = fetchServerVersion(url)
            val v = result.getOrNull()
            if (v != null) {
                status = "server ${v.server} · min app ${v.minApp}\nvia $url"
                break
            }
            status = "no server reachable\n${result.exceptionOrNull()?.javaClass?.simpleName}: ${result.exceptionOrNull()?.message}"
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(BactaPalette.Base).safeDrawingPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 480.dp).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("BACTA·OS", color = BactaPalette.Mx4, fontFamily = JetBrainsMono, fontSize = 28.sp)
            Text("android ${BuildConfig.VERSION_NAME}", color = BactaPalette.TextMuted, fontFamily = JetBrainsMono, fontSize = 12.sp)
            Text(status, color = BactaPalette.TextSecondary, fontFamily = JetBrainsMono, fontSize = 14.sp, modifier = Modifier.padding(top = 24.dp))
        }
    }
}
