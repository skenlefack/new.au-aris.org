package org.auibar.aris.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import org.auibar.aris.mobile.ui.navigation.ArisNavGraph
import org.auibar.aris.mobile.ui.theme.ArisTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ArisTheme {
                val navController = rememberNavController()
                ArisNavGraph(navController = navController)
            }
        }
    }
}
