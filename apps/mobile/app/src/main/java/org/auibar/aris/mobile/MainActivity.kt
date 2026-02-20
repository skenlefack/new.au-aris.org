package org.auibar.aris.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import org.auibar.aris.mobile.ui.components.OfflineBanner
import org.auibar.aris.mobile.ui.navigation.ArisNavGraph
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.auibar.aris.mobile.util.ConnectivityObserver
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var connectivityObserver: ConnectivityObserver

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ArisTheme {
                val isOnline by connectivityObserver.isOnline.collectAsStateWithLifecycle(
                    initialValue = true,
                )
                Column(modifier = Modifier.fillMaxSize()) {
                    OfflineBanner(isOffline = !isOnline)
                    val navController = rememberNavController()
                    ArisNavGraph(navController = navController)
                }
            }
        }
    }
}
