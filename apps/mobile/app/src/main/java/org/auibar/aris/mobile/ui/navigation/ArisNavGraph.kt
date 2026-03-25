package org.auibar.aris.mobile.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.zIndex
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
import org.auibar.aris.mobile.ui.home.HomeDashboardScreen
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
import org.auibar.aris.mobile.ui.message.ComposeMessageScreen
import org.auibar.aris.mobile.ui.message.MessageListScreen
import org.auibar.aris.mobile.ui.message.MessageThreadScreen
import org.auibar.aris.mobile.ui.components.UserTopBanner
import org.auibar.aris.mobile.ui.domain.DomainDashboardScreen
import org.auibar.aris.mobile.ui.lock.AppLockScreen
import org.auibar.aris.mobile.ui.lock.SetPinScreen
import org.auibar.aris.mobile.ui.navigation.AppLockViewModel
import org.auibar.aris.mobile.ui.submission.SubmissionListScreen
import org.auibar.aris.mobile.ui.tenant.TenantHierarchyScreen
import org.auibar.aris.mobile.util.AppLockManager

object ArisRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val HOME = "home"
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
    const val OFFLINE_MAP = "offline-map?domainKey={domainKey}"
    const val OFFLINE_MAP_BASE = "offline-map"
    const val REPORTS = "reports"
    const val SUBMISSION_DETAIL = "submission/{submissionId}"
    const val CONFLICT_RESOLUTION = "conflict/{submissionId}"
    const val TENANT_HIERARCHY = "tenant-hierarchy"
    const val DOMAIN_DASHBOARD = "domain/{domainKey}"
    const val APP_LOCK = "app-lock"
    const val SET_PIN = "set-pin"
    const val MESSAGES = "messages"
    const val COMPOSE_MESSAGE = "compose-message"
    const val MESSAGE_THREAD = "messages/{threadId}/{recipientId}/{recipientName}"

    fun domainDashboard(domainKey: String) = "domain/$domainKey"
    fun campaignDetail(campaignId: String) = "campaign/$campaignId"
    fun formFill(campaignId: String) = "form/$campaignId"
    fun livestockCensus(campaignId: String) = "livestock-census/$campaignId"
    fun productionRecord(campaignId: String) = "production-record/$campaignId"
    fun photoGallery(submissionId: String) = "photo-gallery/$submissionId"
    fun submissionDetail(submissionId: String) = "submission/$submissionId"
    fun conflictResolution(submissionId: String) = "conflict/$submissionId"
    fun offlineMap(domainKey: String? = null) =
        if (domainKey != null) "offline-map?domainKey=$domainKey" else "offline-map"
    fun messageThread(threadId: String, recipientId: String, recipientName: String) =
        "messages/$threadId/$recipientId/$recipientName"
}

data class BottomNavItem(
    val route: String,
    val icon: ImageVector,
    val labelRes: Int,
)

val bottomNavItems = listOf(
    BottomNavItem(ArisRoutes.HOME, Icons.Default.Dashboard, R.string.dashboard),
    BottomNavItem(ArisRoutes.DASHBOARD, Icons.Default.Apps, R.string.domains),
    BottomNavItem(ArisRoutes.CAMPAIGNS, Icons.AutoMirrored.Filled.List, R.string.campaigns),
    BottomNavItem(ArisRoutes.NOTIFICATIONS, Icons.Default.Notifications, R.string.notifications),
)

private val bottomNavRoutes = bottomNavItems.map { it.route }.toSet()

private val hideBannerRoutes = setOf(ArisRoutes.SPLASH, ArisRoutes.LOGIN, ArisRoutes.APP_LOCK, ArisRoutes.SET_PIN)

@Composable
fun ArisNavGraph(
    navController: NavHostController,
    startDestination: String = ArisRoutes.SPLASH,
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomNav = currentRoute in bottomNavRoutes
    val showBanner = currentRoute != null && currentRoute !in hideBannerRoutes

    val bannerViewModel: AppBannerViewModel = hiltViewModel()

    Scaffold(
        bottomBar = {
            if (showBottomNav) {
                ArisBottomBar(navController = navController)
            }
        },
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding).consumeWindowInsets(innerPadding)) {
            if (showBanner && bannerViewModel.isLoggedIn) {
                UserTopBanner(
                    userName = bannerViewModel.userName,
                    userEmail = bannerViewModel.userEmail,
                    userRole = bannerViewModel.userRole,
                    tenantLevel = bannerViewModel.tenantLevel,
                    modifier = Modifier.zIndex(1f),
                    onProfileClick = {
                        navController.navigate(ArisRoutes.SETTINGS) {
                            launchSingleTop = true
                        }
                    },
                    onSettingsClick = {
                        navController.navigate(ArisRoutes.SETTINGS) {
                            launchSingleTop = true
                        }
                    },
                    onLogoutClick = {
                        bannerViewModel.logout()
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
            NavHost(
                navController = navController,
                startDestination = startDestination,
            ) {
            composable(ArisRoutes.SPLASH) {
                SplashScreen(
                    onNavigateToDashboard = {
                        navController.navigate(ArisRoutes.HOME) {
                            popUpTo(ArisRoutes.SPLASH) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(ArisRoutes.SPLASH) { inclusive = true }
                        }
                    },
                    onNavigateToLock = {
                        navController.navigate(ArisRoutes.APP_LOCK) {
                            popUpTo(ArisRoutes.SPLASH) { inclusive = true }
                        }
                    },
                )
            }

            composable(ArisRoutes.LOGIN) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(ArisRoutes.HOME) {
                            popUpTo(ArisRoutes.LOGIN) { inclusive = true }
                        }
                    },
                )
            }

            composable(ArisRoutes.HOME) {
                HomeDashboardScreen(
                    onReports = {
                        navController.navigate(ArisRoutes.REPORTS)
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
                    onReports = {
                        navController.navigate(ArisRoutes.REPORTS)
                    },
                    onSettings = {
                        navController.navigate(ArisRoutes.SETTINGS)
                    },
                    onLogout = {
                        navController.navigate(ArisRoutes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onDomainClick = { domainKey ->
                        navController.navigate(ArisRoutes.domainDashboard(domainKey))
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
                    onSubmissionClick = { submissionId ->
                        navController.navigate(ArisRoutes.submissionDetail(submissionId))
                    },
                    onConflictClick = { submissionId ->
                        navController.navigate(ArisRoutes.conflictResolution(submissionId))
                    },
                )
            }

            composable(
                route = ArisRoutes.SUBMISSION_DETAIL,
                arguments = listOf(navArgument("submissionId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val submissionId = backStackEntry.arguments?.getString("submissionId") ?: ""
                PhotoGalleryScreen(
                    submissionId = submissionId,
                    onBack = { navController.popBackStack() },
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
                    onSetPin = {
                        navController.navigate(ArisRoutes.SET_PIN)
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
                GpsTrackScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.OFFLINE_MAP,
                arguments = listOf(
                    navArgument("domainKey") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) {
                OfflineMapScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.REPORTS) {
                MiniReportsScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.DOMAIN_DASHBOARD,
                arguments = listOf(navArgument("domainKey") { type = NavType.StringType }),
            ) { backStackEntry ->
                val domainKey = backStackEntry.arguments?.getString("domainKey") ?: ""
                DomainDashboardScreen(
                    domainKey = domainKey,
                    onBack = { navController.popBackStack() },
                    onCampaignClick = { campaignId ->
                        navController.navigate(ArisRoutes.campaignDetail(campaignId))
                    },
                    onNewSubmission = {
                        navController.navigate(ArisRoutes.CAMPAIGNS)
                    },
                    onReports = {
                        navController.navigate(ArisRoutes.REPORTS)
                    },
                    onMap = {
                        navController.navigate(ArisRoutes.offlineMap(domainKey))
                    },
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
                    onCompose = {
                        navController.navigate(ArisRoutes.COMPOSE_MESSAGE)
                    },
                )
            }

            composable(ArisRoutes.COMPOSE_MESSAGE) {
                ComposeMessageScreen(
                    onBack = { navController.popBackStack() },
                    onMessageSent = { threadId, recipientId, recipientName ->
                        navController.navigate(
                            ArisRoutes.messageThread(threadId, recipientId, recipientName),
                        ) {
                            popUpTo(ArisRoutes.MESSAGES)
                        }
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

            composable(ArisRoutes.APP_LOCK) {
                val appLockManager: AppLockManager = hiltViewModel<AppLockViewModel>().appLockManager
                AppLockScreen(
                    onBiometricRequest = { /* biometric prompt handled by Activity */ },
                    onPinVerified = {
                        appLockManager.recordActivity()
                        navController.navigate(ArisRoutes.HOME) {
                            popUpTo(ArisRoutes.APP_LOCK) { inclusive = true }
                        }
                    },
                    verifyPin = { pin -> appLockManager.verifyPin(pin) },
                    isBiometricAvailable = appLockManager.isBiometricEnabled,
                )
            }

            composable(ArisRoutes.SET_PIN) {
                val appLockManager: AppLockManager = hiltViewModel<AppLockViewModel>().appLockManager
                SetPinScreen(
                    onPinSet = { pin ->
                        appLockManager.setPin(pin)
                        navController.popBackStack()
                    },
                    onBack = { navController.popBackStack() },
                )
            }
        }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
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
