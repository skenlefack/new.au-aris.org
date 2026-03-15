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
import androidx.navigation.navDeepLink
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.conflict.ConflictResolutionScreen
import org.auibar.aris.mobile.ui.campaign.CampaignDetailScreen
import org.auibar.aris.mobile.ui.campaign.CampaignListScreen
import org.auibar.aris.mobile.ui.dashboard.DashboardScreen
import org.auibar.aris.mobile.ui.form.FormFillScreen
import org.auibar.aris.mobile.ui.gpstrack.GpsTrackScreen
import org.auibar.aris.mobile.ui.map.OfflineMapScreen
import org.auibar.aris.mobile.ui.livestock.LivestockCensusScreen
import org.auibar.aris.mobile.ui.livestock.ProductionRecordScreen
import org.auibar.aris.mobile.ui.login.LoginScreen
import org.auibar.aris.mobile.ui.notification.NotificationListScreen
import org.auibar.aris.mobile.ui.splash.SplashScreen
import org.auibar.aris.mobile.ui.notification.NotificationListViewModel
import org.auibar.aris.mobile.ui.photo.PhotoGalleryScreen
import org.auibar.aris.mobile.ui.reports.MiniReportsScreen
import org.auibar.aris.mobile.ui.settings.SettingsScreen
import org.auibar.aris.mobile.ui.message.MessageListScreen
import org.auibar.aris.mobile.ui.message.MessageThreadScreen
import org.auibar.aris.mobile.ui.submission.SubmissionListScreen
import org.auibar.aris.mobile.ui.tenant.TenantHierarchyScreen

object ArisRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val CAMPAIGNS = "campaigns"
    const val CAMPAIGN_DETAIL = "campaign/{campaignId}"
    const val FORM_FILL = "form/{campaignId}"
    const val SUBMISSIONS = "submissions"
    const val NOTIFICATIONS = "notifications"
    const val SETTINGS = "settings"
    const val LIVESTOCK_CENSUS = "livestock-census/{campaignId}"
    const val PRODUCTION_RECORD = "production-record/{campaignId}"
    const val PHOTO_GALLERY = "photo-gallery/{submissionId}"
    const val GPS_TRACK = "gps-track"
    const val OFFLINE_MAP = "offline-map"
    const val REPORTS = "reports"
    const val CONFLICT_RESOLUTION = "conflict/{submissionId}"
    const val TENANT_HIERARCHY = "tenant-hierarchy"
    const val MESSAGES = "messages"
    const val MESSAGE_THREAD = "messages/{threadId}/{recipientId}/{recipientName}"

    fun campaignDetail(campaignId: String) = "campaign/$campaignId"
    fun formFill(campaignId: String) = "form/$campaignId"
    fun livestockCensus(campaignId: String) = "livestock-census/$campaignId"
    fun productionRecord(campaignId: String) = "production-record/$campaignId"
    fun photoGallery(submissionId: String) = "photo-gallery/$submissionId"
    fun submissionDetail(submissionId: String) = "submission/$submissionId"
    fun conflictResolution(submissionId: String) = "conflict/$submissionId"
    fun messageThread(threadId: String, recipientId: String, recipientName: String) =
        "messages/$threadId/$recipientId/$recipientName"
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
    startDestination: String = ArisRoutes.SPLASH,
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
            composable(ArisRoutes.SPLASH) {
                SplashScreen(
                    onNavigateToDashboard = {
                        navController.navigate(ArisRoutes.DASHBOARD) {
                            popUpTo(ArisRoutes.SPLASH) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(ArisRoutes.SPLASH) { inclusive = true }
                        }
                    },
                )
            }

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
                deepLinks = listOf(navDeepLink { uriPattern = "aris://campaign/{campaignId}" }),
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
                    onConflictClick = { submissionId ->
                        navController.navigate(ArisRoutes.conflictResolution(submissionId))
                    },
                )
            }

            composable(
                route = ArisRoutes.CONFLICT_RESOLUTION,
                arguments = listOf(navArgument("submissionId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val submissionId = backStackEntry.arguments?.getString("submissionId") ?: ""
                ConflictResolutionScreen(
                    submissionId = submissionId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.NOTIFICATIONS,
                deepLinks = listOf(navDeepLink { uriPattern = "aris://notifications" }),
            ) {
                NotificationListScreen()
            }

            composable(ArisRoutes.SETTINGS) {
                SettingsScreen(
                    onLogout = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onTenantHierarchy = {
                        navController.navigate(ArisRoutes.TENANT_HIERARCHY)
                    },
                    onMessages = {
                        navController.navigate(ArisRoutes.MESSAGES)
                    },
                )
            }

            composable(
                route = ArisRoutes.LIVESTOCK_CENSUS,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                LivestockCensusScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.PRODUCTION_RECORD,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                ProductionRecordScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.PHOTO_GALLERY,
                arguments = listOf(navArgument("submissionId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val submissionId = backStackEntry.arguments?.getString("submissionId") ?: ""
                PhotoGalleryScreen(
                    submissionId = submissionId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.GPS_TRACK) {
                GpsTrackScreen()
            }

            composable(ArisRoutes.OFFLINE_MAP) {
                OfflineMapScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.REPORTS) {
                MiniReportsScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.TENANT_HIERARCHY) {
                TenantHierarchyScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.MESSAGES) {
                MessageListScreen(
                    onBack = { navController.popBackStack() },
                    onThreadClick = { threadId, recipientId, recipientName ->
                        navController.navigate(
                            ArisRoutes.messageThread(threadId, recipientId, recipientName),
                        )
                    },
                )
            }

            composable(
                route = ArisRoutes.MESSAGE_THREAD,
                arguments = listOf(
                    navArgument("threadId") { type = NavType.StringType },
                    navArgument("recipientId") { type = NavType.StringType },
                    navArgument("recipientName") { type = NavType.StringType },
                ),
            ) {
                MessageThreadScreen(
                    onBack = { navController.popBackStack() },
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
