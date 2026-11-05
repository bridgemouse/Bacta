package io.github.bridgemouse.bacta

import javax.inject.Inject
import io.github.bridgemouse.bacta.ui.format.LocalFormatters
import io.github.bridgemouse.bacta.ui.format.Formatters
import androidx.compose.runtime.CompositionLocalProvider
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import io.github.bridgemouse.bacta.ui.designsystem.BactaTheme
import io.github.bridgemouse.bacta.ui.navigation.AppRoot

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var formatters: Formatters

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val transparent = android.graphics.Color.TRANSPARENT
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(transparent),
            navigationBarStyle = SystemBarStyle.dark(transparent),
        )
        setContent { CompositionLocalProvider(LocalFormatters provides formatters) { BactaTheme { AppRoot() } } }
    }
}
