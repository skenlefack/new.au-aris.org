package org.auibar.aris.mobile.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.campaign.CampaignDetailScreen
import org.auibar.aris.mobile.ui.campaign.CampaignListScreen
import org.auibar.aris.mobile.ui.dashboard.DashboardScreen
import org.auibar.aris.mobile.ui.form.FormFillScreen
import org.auibar.aris.mobile.ui.login.LoginScreen
import org.auibar.aris.mobile.ui.notification.NotificationListScreen
import org.auibar.aris.mobile.ui.notification.NotificationListViewModel
import org.auibar.aris.mobile.ui.settings.SettingsScreen
import org.auibar.aris.mobile.ui.submission.SubmissionListScreen

object ArisRoutes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val CAMPAIGNS = "campaigns"
    const val CAMPAIGN_DETAIL = "campaign/{campaignId}"
    const val FORM_FILL = "form/{campaignId}"
    const val SUBMISSIONS = "submissions"
    const val NOTIFICATIONS = "notifications"
    const val SETTINGS = "settings"

    fun campaignDetail(campaignId: String) = "campaign/$campaignId"
    fun formFill(campaignId: String) = "form/$campaignId"
}

data class BottomNavItem(
    val route: String,
    val icon: ImageVector,
    val labelRes: Int,
)

val bottomNavItems = listOf(
    BottomNavItem(ArisRoutes.DASHBOARD, Icons.Default.Dashboard, R.string.dashboard),
    BottomNavItem(ArisRoutes.CAMPAIGNS, Icons.Default.List, R.string.campaigns),
    BottomNavItem(ArisRoutes.NOTIFICATIONS, Icons.Default.Notifications, R.string.notifications),
    BottomNavItem(ArisRoutes.SETTINGS, Icons.Default.Settings, R.string.settings),
)

private val bottomNavRoutes = bottomNavItems.map { it.route }.toSet()

@Composable
fun ArisNavGraph(
    navController: NavHostController,
    startDestination: String = ArisRoutes.LOGIN,
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomNav = currentRoute in bottomNavRoutes

    Scaffold(
        bottomBar = {
            if (showBottomNav) {
                ArisBottomBar(navController = navController)
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(ArisRoutes.LOGIN) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(ArisRoutes.DASHBOARD) {
                            popUpTo(ArisRoutes.LOGIN) { inclusive = true }
                        }
                    },
                )
            }

            composable(ArisRoutes.DASHBOARD) {
                DashboardScreen(
                    onCampaignClick = { campaignId ->
                        navController.navigate(ArisRoutes.campaignDetail(campaignId))
                    },
                    onNewSubmission = {
                        navController.navigate(ArisRoutes.CAMPAIGNS)
                    },
                )
            }

            composable(ArisRoutes.CAMPAIGNS) {
                CampaignListScreen(
                    onCampaignClick = { campaignId ->
                        navController.navigate(ArisRoutes.campaignDetail(campaignId))
                    },
                    onSubmissionsClick = {
                        navController.navigate(ArisRoutes.SUBMISSIONS)
                    },
                    onLogout = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }

            composable(
                route = ArisRoutes.CAMPAIGN_DETAIL,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                CampaignDetailScreen(
                    campaignId = campaignId,
                    onNewSubmission = {
                        navController.navigate(ArisRoutes.formFill(campaignId))
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.FORM_FILL,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                FormFillScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.SUBMISSIONS) {
                SubmissionListScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.NOTIFICATIONS) {
                NotificationListScreen()
            }

            composable(ArisRoutes.SETTINGS) {
                SettingsScreen(
                    onLogout = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
        }
    }
}

@Composable
fun ArisBottomBar(navController: NavHostController) {
    val notificationViewModel: NotificationListViewModel = hiltViewModel()
    val unreadCount by notificationViewModel.unreadCount.collectAsStateWithLifecycle()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    NavigationBar {
        bottomNavItems.forEach { item ->
            val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
            NavigationBarItem(
                selected = selected,
                onClick = {
                    navController.navigate(item.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = {
                    if (item.route == ArisRoutes.NOTIFICATIONS && unreadCount > 0) {
                        BadgedBox(
                            badge = {
                                Badge {
                                    Text(
                                        text = if (unreadCount > 99) "99+" else "$unreadCount",
                                        style = MaterialTheme.typography.labelSmall,
                                    )
                                }
                            },
                        ) {
                            Icon(item.icon, contentDescription = stringResource(item.labelRes))
                        }
                    } else {
                        Icon(item.icon, contentDescription = stringResource(item.labelRes))
                    }
                },
                label = { Text(stringResource(item.labelRes)) },
            )
        }
    }
}
