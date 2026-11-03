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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dagger.hilt.android.AndroidEntryPoint

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
        setContent { HelloScreen() }
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
        modifier = Modifier.fillMaxSize().background(Color(BactaColors.Base)).safeDrawingPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 480.dp).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("BACTA·OS", color = Color(BactaColors.Mx4), fontFamily = FontFamily.Monospace, fontSize = 28.sp)
            Text("android ${BuildConfig.VERSION_NAME}", color = Color(BactaColors.TextMuted), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            Text(status, color = Color(BactaColors.TextSecondary), fontFamily = FontFamily.Monospace, fontSize = 14.sp, modifier = Modifier.padding(top = 24.dp))
        }
    }
}
