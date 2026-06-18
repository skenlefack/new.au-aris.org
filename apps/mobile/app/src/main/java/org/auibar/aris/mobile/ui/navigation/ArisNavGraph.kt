package org.auibar.aris.mobile.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.automirrored.filled.FactCheck
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
import org.auibar.aris.mobile.ui.analytics.AnalyticsDashboardScreen
import org.auibar.aris.mobile.ui.conflict.ConflictResolutionScreen
import org.auibar.aris.mobile.ui.campaign.CampaignDetailScreen
import org.auibar.aris.mobile.ui.campaign.CampaignListScreen
import org.auibar.aris.mobile.ui.dashboard.DashboardScreen
import org.auibar.aris.mobile.ui.form.FormFillScreen
import org.auibar.aris.mobile.ui.gpstrack.GpsTrackScreen
import org.auibar.aris.mobile.ui.home.HomeDashboardScreen
import org.auibar.aris.mobile.ui.map.OfflineMapScreen
import org.auibar.aris.mobile.ui.map.TileDownloadScreen
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
import org.auibar.aris.mobile.ui.paid.PaidDashboardScreen
import org.auibar.aris.mobile.ui.paid.PaidCollecteScreen
import org.auibar.aris.mobile.ui.health.OutbreakReportScreen
import org.auibar.aris.mobile.ui.health.SurveillanceEventScreen
import org.auibar.aris.mobile.ui.fisheries.CaptureRecordScreen
import org.auibar.aris.mobile.ui.fisheries.AquacultureRecordScreen
import org.auibar.aris.mobile.ui.trade.TradeFlowScreen
import org.auibar.aris.mobile.ui.trade.SPSCertificateScreen
import org.auibar.aris.mobile.ui.governance.LegalFrameworkScreen
import org.auibar.aris.mobile.ui.governance.VetCapacityScreen
import org.auibar.aris.mobile.ui.apiculture.ApiaryRecordScreen
import org.auibar.aris.mobile.ui.apiculture.ColonyHealthScreen
import org.auibar.aris.mobile.ui.wildlife.HumanWildlifeConflictScreen
import org.auibar.aris.mobile.ui.wildlife.WildlifeObservationScreen
import org.auibar.aris.mobile.ui.climate.RangelandScreen
import org.auibar.aris.mobile.ui.climate.WaterStressScreen
import org.auibar.aris.mobile.ui.knowledge.KnowledgeHubScreen
import org.auibar.aris.mobile.ui.knowledge.KnowledgeSearchScreen
import org.auibar.aris.mobile.ui.knowledge.KnowledgeArticleScreen
import org.auibar.aris.mobile.ui.knowledge.KnowledgeCourseListScreen
import org.auibar.aris.mobile.ui.knowledge.KnowledgeCourseDetailScreen
import org.auibar.aris.mobile.ui.indicators.IndicatorListScreen
import org.auibar.aris.mobile.ui.indicators.IndicatorDetailScreen
import org.auibar.aris.mobile.ui.reportview.ReportListScreen
import org.auibar.aris.mobile.ui.reportview.ReportDetailScreen
import org.auibar.aris.mobile.ui.dashboardview.DashboardListScreen
import org.auibar.aris.mobile.ui.dashboardview.DashboardViewScreen
import org.auibar.aris.mobile.ui.flashalert.FlashAlertListScreen
import org.auibar.aris.mobile.ui.lock.AppLockScreen
import org.auibar.aris.mobile.ui.lock.SetPinScreen
import org.auibar.aris.mobile.ui.navigation.AppLockViewModel
import org.auibar.aris.mobile.ui.submission.SubmissionListScreen
import org.auibar.aris.mobile.ui.tenant.TenantHierarchyScreen
import org.auibar.aris.mobile.ui.validation.ValidationListScreen
import org.auibar.aris.mobile.util.AppLockManager

object ArisRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val HOME = "home"
    const val DASHBOARD = "dashboard"
    const val CAMPAIGNS = "campaigns"
    const val CAMPAIGN_DETAIL = "campaign/{campaignId}"
    const val FORM_FILL = "form/{campaignId}?templateId={templateId}&mode={mode}"
    const val FORM_FILL_BASE = "form/{campaignId}"
    const val SUBMISSIONS = "submissions"
    const val NOTIFICATIONS = "notifications"
    const val VALIDATION = "validation"
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
    const val SUB_DOMAIN_DASHBOARD = "domain/{domainKey}/sub/{subDomainCode}?subDomainLabel={subDomainLabel}"
    const val APP_LOCK = "app-lock"
    const val SET_PIN = "set-pin"
    const val OUTBREAK_REPORT = "outbreak-report/{campaignId}"
    const val SURVEILLANCE_EVENT = "surveillance-event/{campaignId}"
    const val CAPTURE_RECORD = "capture-record/{campaignId}"
    const val AQUACULTURE_RECORD = "aquaculture-record/{campaignId}"
    const val TRADE_FLOW = "trade-flow/{campaignId}"
    const val SPS_CERTIFICATE = "sps-certificate/{campaignId}"
    const val LEGAL_FRAMEWORK = "legal-framework/{campaignId}"
    const val VET_CAPACITY = "vet-capacity/{campaignId}"
    const val APIARY_RECORD = "apiary-record/{campaignId}"
    const val COLONY_HEALTH = "colony-health/{campaignId}"
    const val HWC_REPORT = "hwc-report/{campaignId}"
    const val WILDLIFE_OBSERVATION = "wildlife-observation/{campaignId}"
    const val RANGELAND = "rangeland/{campaignId}"
    const val WATER_STRESS = "water-stress/{campaignId}"
    const val PAID_DASHBOARD = "paid-dashboard"
    const val PAID_COLLECTE = "paid-collecte"
    const val KNOWLEDGE_HUB = "knowledge-hub"
    const val KNOWLEDGE_SEARCH = "knowledge-search"
    const val KNOWLEDGE_ARTICLE = "knowledge-article/{articleId}"
    const val KNOWLEDGE_COURSES = "knowledge-courses"
    const val KNOWLEDGE_COURSE_DETAIL = "knowledge-course/{courseId}"
    const val ANALYTICS_DASHBOARD = "analytics-dashboard"
    const val INDICATORS = "indicators"
    const val INDICATOR_LIST = "indicators?domainCode={domainCode}"
    const val INDICATOR_DETAIL = "indicator/{indicatorId}"
    const val REPORT_LIST = "report-list?domainCode={domainCode}"
    const val REPORT_DETAIL = "report/{reportId}"
    const val DASHBOARD_LIST = "dashboard-list"
    const val DASHBOARD_VIEW = "dashboard-view/{dashboardId}"
    const val FLASH_ALERTS = "flash-alerts"
    const val TILE_DOWNLOAD = "tile-download"
    const val MESSAGES = "messages"
    const val COMPOSE_MESSAGE = "compose-message"
    const val MESSAGE_THREAD = "messages/{threadId}/{recipientId}/{recipientName}"

    fun domainDashboard(domainKey: String) = "domain/$domainKey"
    fun campaignDetail(campaignId: String) = "campaign/$campaignId"
    fun formFill(campaignId: String, templateId: String? = null, mode: String = "fill") =
        buildString {
            append("form/$campaignId")
            val params = mutableListOf<String>()
            if (templateId != null) params.add("templateId=$templateId")
            if (mode != "fill") params.add("mode=$mode")
            if (params.isNotEmpty()) append("?${params.joinToString("&")}")
        }
    fun livestockCensus(campaignId: String) = "livestock-census/$campaignId"
    fun productionRecord(campaignId: String) = "production-record/$campaignId"
    fun outbreakReport(campaignId: String) = "outbreak-report/$campaignId"
    fun surveillanceEvent(campaignId: String) = "surveillance-event/$campaignId"
    fun captureRecord(campaignId: String) = "capture-record/$campaignId"
    fun aquacultureRecord(campaignId: String) = "aquaculture-record/$campaignId"
    fun tradeFlow(campaignId: String) = "trade-flow/$campaignId"
    fun spsCertificate(campaignId: String) = "sps-certificate/$campaignId"
    fun legalFramework(campaignId: String) = "legal-framework/$campaignId"
    fun vetCapacity(campaignId: String) = "vet-capacity/$campaignId"
    fun apiaryRecord(campaignId: String) = "apiary-record/$campaignId"
    fun colonyHealth(campaignId: String) = "colony-health/$campaignId"
    fun hwcReport(campaignId: String) = "hwc-report/$campaignId"
    fun wildlifeObservation(campaignId: String) = "wildlife-observation/$campaignId"
    fun rangeland(campaignId: String) = "rangeland/$campaignId"
    fun waterStress(campaignId: String) = "water-stress/$campaignId"
    fun photoGallery(submissionId: String) = "photo-gallery/$submissionId"
    fun submissionDetail(submissionId: String) = "submission/$submissionId"
    fun conflictResolution(submissionId: String) = "conflict/$submissionId"
    fun offlineMap(domainKey: String? = null) =
        if (domainKey != null) "offline-map?domainKey=$domainKey" else "offline-map"
    fun knowledgeArticle(articleId: String) = "knowledge-article/$articleId"
    fun knowledgeCourseDetail(courseId: String) = "knowledge-course/$courseId"
    fun messageThread(threadId: String, recipientId: String, recipientName: String) =
        "messages/$threadId/$recipientId/$recipientName"
    fun subDomainDashboard(domainKey: String, subDomainCode: String, subDomainLabel: String) =
        "domain/$domainKey/sub/$subDomainCode?subDomainLabel=${java.net.URLEncoder.encode(subDomainLabel, "UTF-8")}"
    fun indicatorList(domainCode: String? = null) =
        if (domainCode != null) "indicators?domainCode=$domainCode" else "indicators"
    fun indicatorDetail(indicatorId: String) = "indicator/$indicatorId"
    fun reportList(domainCode: String? = null) =
        if (domainCode != null) "report-list?domainCode=$domainCode" else "report-list"
    fun reportDetail(reportId: String) = "report/$reportId"
    fun dashboardView(dashboardId: String) = "dashboard-view/$dashboardId"
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
    BottomNavItem(ArisRoutes.VALIDATION, Icons.AutoMirrored.Filled.FactCheck, R.string.validation),
)

private val bottomNavRoutes = bottomNavItems.map { it.route }.toSet()

private val hideBannerRoutes = setOf(ArisRoutes.SPLASH, ArisRoutes.LOGIN, ArisRoutes.APP_LOCK, ArisRoutes.SET_PIN)

@Composable
fun ArisNavGraph(
    navController: NavHostController,
    startDestination: String = ArisRoutes.SPLASH,
    isOnline: Boolean = true,
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomNav = currentRoute in bottomNavRoutes
    val showBanner = currentRoute != null && currentRoute !in hideBannerRoutes

    val bannerViewModel: AppBannerViewModel = hiltViewModel()
    val notifViewModel: NotificationListViewModel = hiltViewModel()
    val bannerUnreadCount by notifViewModel.unreadCount.collectAsStateWithLifecycle()

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
                    unreadNotifications = bannerUnreadCount,
                    isOnline = isOnline,
                    localeManager = bannerViewModel.localeManager,
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
                    onNotificationsClick = {
                        navController.navigate(ArisRoutes.NOTIFICATIONS) {
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
                        when (domainKey) {
                            "paid" -> navController.navigate(ArisRoutes.PAID_DASHBOARD)
                            "knowledge" -> navController.navigate(ArisRoutes.KNOWLEDGE_HUB)
                            else -> navController.navigate(ArisRoutes.domainDashboard(domainKey))
                        }
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
                    onFillTemplate = { cId, templateId, mode ->
                        navController.navigate(ArisRoutes.formFill(cId, templateId, mode))
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.FORM_FILL,
                arguments = listOf(
                    navArgument("campaignId") { type = NavType.StringType },
                    navArgument("templateId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("mode") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = "fill"
                    },
                ),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                val mode = backStackEntry.arguments?.getString("mode") ?: "fill"
                FormFillScreen(
                    campaignId = campaignId,
                    readOnly = mode == "preview",
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

            composable(ArisRoutes.VALIDATION) {
                ValidationListScreen()
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
                    onAnalytics = {
                        navController.navigate(ArisRoutes.ANALYTICS_DASHBOARD)
                    },
                    onTileDownload = {
                        navController.navigate(ArisRoutes.TILE_DOWNLOAD)
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

            // ── Animal Health ──
            composable(
                route = ArisRoutes.OUTBREAK_REPORT,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                OutbreakReportScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.SURVEILLANCE_EVENT,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                SurveillanceEventScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Fisheries ──
            composable(
                route = ArisRoutes.CAPTURE_RECORD,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                CaptureRecordScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.AQUACULTURE_RECORD,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                AquacultureRecordScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Trade & SPS ──
            composable(
                route = ArisRoutes.TRADE_FLOW,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                TradeFlowScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.SPS_CERTIFICATE,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                SPSCertificateScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Governance ──
            composable(
                route = ArisRoutes.LEGAL_FRAMEWORK,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                LegalFrameworkScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.VET_CAPACITY,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                VetCapacityScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Apiculture ──
            composable(
                route = ArisRoutes.APIARY_RECORD,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                ApiaryRecordScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.COLONY_HEALTH,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                ColonyHealthScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Wildlife ──
            composable(
                route = ArisRoutes.HWC_REPORT,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                HumanWildlifeConflictScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.WILDLIFE_OBSERVATION,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                WildlifeObservationScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Climate & Environment ──
            composable(
                route = ArisRoutes.RANGELAND,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                RangelandScreen(
                    campaignId = campaignId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.WATER_STRESS,
                arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val campaignId = backStackEntry.arguments?.getString("campaignId") ?: ""
                WaterStressScreen(
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
                    onTileDownload = {
                        navController.navigate(ArisRoutes.TILE_DOWNLOAD)
                    },
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
                    onDomainForm = { action ->
                        val route = when (action) {
                            "outbreak_report" -> ArisRoutes.outbreakReport("new")
                            "surveillance_event" -> ArisRoutes.surveillanceEvent("new")
                            "capture_record" -> ArisRoutes.captureRecord("new")
                            "aquaculture_record" -> ArisRoutes.aquacultureRecord("new")
                            "trade_flow" -> ArisRoutes.tradeFlow("new")
                            "sps_certificate" -> ArisRoutes.spsCertificate("new")
                            "legal_framework" -> ArisRoutes.legalFramework("new")
                            "vet_capacity" -> ArisRoutes.vetCapacity("new")
                            "apiary_record" -> ArisRoutes.apiaryRecord("new")
                            "colony_health" -> ArisRoutes.colonyHealth("new")
                            "hwc_report" -> ArisRoutes.hwcReport("new")
                            "wildlife_observation" -> ArisRoutes.wildlifeObservation("new")
                            "rangeland" -> ArisRoutes.rangeland("new")
                            "water_stress" -> ArisRoutes.waterStress("new")
                            else -> return@DomainDashboardScreen
                        }
                        navController.navigate(route)
                    },
                    onIndicators = {
                        navController.navigate(ArisRoutes.indicatorList(domainKey))
                    },
                    onDashboards = {
                        navController.navigate(ArisRoutes.DASHBOARD_LIST)
                    },
                    onFlashAlerts = {
                        navController.navigate(ArisRoutes.FLASH_ALERTS)
                    },
                    onSubDomainClick = { dk, subCode, subLabel ->
                        navController.navigate(ArisRoutes.subDomainDashboard(dk, subCode, subLabel))
                    },
                )
            }

            // ── Sub-Domain Dashboard ──
            composable(
                route = ArisRoutes.SUB_DOMAIN_DASHBOARD,
                arguments = listOf(
                    navArgument("domainKey") { type = NavType.StringType },
                    navArgument("subDomainCode") { type = NavType.StringType },
                    navArgument("subDomainLabel") { type = NavType.StringType; nullable = true; defaultValue = null },
                ),
            ) { backStackEntry ->
                val dk = backStackEntry.arguments?.getString("domainKey") ?: ""
                DomainDashboardScreen(
                    domainKey = dk,
                    onBack = { navController.popBackStack() },
                    onCampaignClick = { campaignId -> navController.navigate(ArisRoutes.campaignDetail(campaignId)) },
                    onNewSubmission = { navController.navigate(ArisRoutes.CAMPAIGNS) },
                    onDashboards = { navController.navigate(ArisRoutes.DASHBOARD_LIST) },
                )
            }

            // ── Knowledge Hub ──
            composable(ArisRoutes.KNOWLEDGE_HUB) {
                KnowledgeHubScreen(
                    onArticleClick = { articleId ->
                        navController.navigate(ArisRoutes.knowledgeArticle(articleId))
                    },
                    onSearch = {
                        navController.navigate(ArisRoutes.KNOWLEDGE_SEARCH)
                    },
                    onCourseList = {
                        navController.navigate(ArisRoutes.KNOWLEDGE_COURSES)
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.KNOWLEDGE_SEARCH) {
                KnowledgeSearchScreen(
                    onArticleClick = { articleId ->
                        navController.navigate(ArisRoutes.knowledgeArticle(articleId))
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.KNOWLEDGE_ARTICLE,
                arguments = listOf(navArgument("articleId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val articleId = backStackEntry.arguments?.getString("articleId") ?: ""
                KnowledgeArticleScreen(
                    articleId = articleId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(ArisRoutes.KNOWLEDGE_COURSES) {
                KnowledgeCourseListScreen(
                    onCourseClick = { courseId ->
                        navController.navigate(ArisRoutes.knowledgeCourseDetail(courseId))
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.KNOWLEDGE_COURSE_DETAIL,
                arguments = listOf(navArgument("courseId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val courseId = backStackEntry.arguments?.getString("courseId") ?: ""
                KnowledgeCourseDetailScreen(
                    courseId = courseId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Analytics Dashboard ──
            composable(ArisRoutes.ANALYTICS_DASHBOARD) {
                AnalyticsDashboardScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Tile Download ──
            composable(ArisRoutes.TILE_DOWNLOAD) {
                TileDownloadScreen(
                    onBack = { navController.popBackStack() },
                )
            }

            // ── PAID ──
            composable(ArisRoutes.PAID_DASHBOARD) {
                PaidDashboardScreen(
                    onBack = { navController.popBackStack() },
                    onCampaignClick = { campaignId ->
                        navController.navigate(ArisRoutes.campaignDetail(campaignId))
                    },
                    onCollecte = {
                        navController.navigate(ArisRoutes.PAID_COLLECTE)
                    },
                )
            }

            composable(ArisRoutes.PAID_COLLECTE) {
                PaidCollecteScreen(
                    onBack = { navController.popBackStack() },
                    onTemplateClick = { campaignId, templateId ->
                        navController.navigate(ArisRoutes.formFill(campaignId, templateId))
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

            // ── Indicators (Chantier C) ──
            composable(
                route = ArisRoutes.INDICATOR_LIST,
                arguments = listOf(navArgument("domainCode") {
                    type = NavType.StringType; nullable = true; defaultValue = null
                }),
                deepLinks = listOf(navDeepLink { uriPattern = "aris://indicators" }),
            ) {
                IndicatorListScreen(
                    onIndicatorClick = { id -> navController.navigate(ArisRoutes.indicatorDetail(id)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.INDICATOR_DETAIL,
                arguments = listOf(navArgument("indicatorId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val indicatorId = backStackEntry.arguments?.getString("indicatorId") ?: ""
                IndicatorDetailScreen(
                    indicatorId = indicatorId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Reports (Chantier D) ──
            composable(
                route = ArisRoutes.REPORT_LIST,
                arguments = listOf(navArgument("domainCode") {
                    type = NavType.StringType; nullable = true; defaultValue = null
                }),
            ) {
                ReportListScreen(
                    onReportClick = { id -> navController.navigate(ArisRoutes.reportDetail(id)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.REPORT_DETAIL,
                arguments = listOf(navArgument("reportId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val reportId = backStackEntry.arguments?.getString("reportId") ?: ""
                ReportDetailScreen(
                    reportId = reportId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Dashboards (Chantier B) ──
            composable(ArisRoutes.DASHBOARD_LIST) {
                DashboardListScreen(
                    onDashboardClick = { id -> navController.navigate(ArisRoutes.dashboardView(id)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = ArisRoutes.DASHBOARD_VIEW,
                arguments = listOf(navArgument("dashboardId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val dashboardId = backStackEntry.arguments?.getString("dashboardId") ?: ""
                DashboardViewScreen(
                    dashboardId = dashboardId,
                    onBack = { navController.popBackStack() },
                )
            }

            // ── Flash Alerts (Chantier D) ──
            composable(ArisRoutes.FLASH_ALERTS) {
                FlashAlertListScreen(
                    onBack = { navController.popBackStack() },
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

@Composable
fun ArisBottomBar(navController: NavHostController) {
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
                    Icon(item.icon, contentDescription = stringResource(item.labelRes))
                },
                label = { Text(stringResource(item.labelRes)) },
            )
        }
    }
}
