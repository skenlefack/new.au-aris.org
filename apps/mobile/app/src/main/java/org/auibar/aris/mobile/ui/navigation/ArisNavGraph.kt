package org.auibar.aris.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import org.auibar.aris.mobile.ui.campaign.CampaignDetailScreen
import org.auibar.aris.mobile.ui.campaign.CampaignListScreen
import org.auibar.aris.mobile.ui.form.FormFillScreen
import org.auibar.aris.mobile.ui.login.LoginScreen
import org.auibar.aris.mobile.ui.submission.SubmissionListScreen

object ArisRoutes {
    const val LOGIN = "login"
    const val CAMPAIGNS = "campaigns"
    const val CAMPAIGN_DETAIL = "campaign/{campaignId}"
    const val FORM_FILL = "form/{campaignId}"
    const val SUBMISSIONS = "submissions"

    fun campaignDetail(campaignId: String) = "campaign/$campaignId"
    fun formFill(campaignId: String) = "form/$campaignId"
}

@Composable
fun ArisNavGraph(
    navController: NavHostController,
    startDestination: String = ArisRoutes.LOGIN,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        composable(ArisRoutes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(ArisRoutes.CAMPAIGNS) {
                        popUpTo(ArisRoutes.LOGIN) { inclusive = true }
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
    }
}
