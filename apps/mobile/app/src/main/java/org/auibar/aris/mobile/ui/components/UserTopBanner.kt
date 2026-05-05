package org.auibar.aris.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.GoldAccent
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserTopBanner(
    userName: String,
    userEmail: String,
    userRole: String?,
    tenantLevel: String?,
    unreadNotifications: Int = 0,
    modifier: Modifier = Modifier,
    onProfileClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onLogoutClick: () -> Unit = {},
) {
    val badgeStyle = RoleConfig.badgeStyleFor(userRole)
    val roleLabel = RoleConfig.labelFor(userRole)
    val levelLabel = RoleConfig.tenantLevelLabel(tenantLevel)
    val initials = userName.split(" ")
        .mapNotNull { it.firstOrNull()?.uppercase() }
        .take(2)
        .joinToString("")
        .ifEmpty { "?" }

    var showMenu by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(GradientDarkGreen, GradientMidGreen, GradientTeal),
                    start = Offset.Zero,
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                ),
            )
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // ── Left: AU Logo ──────────────────────────────────────
            Image(
                painter = painterResource(id = R.drawable.au_logo),
                contentDescription = stringResource(R.string.cd_au_logo),
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White),
                contentScale = ContentScale.Fit,
            )

            Spacer(modifier = Modifier.width(10.dp))

            // ── User info + Level badge ────────────────────────────
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = userName.ifEmpty { "ARIS User" },
                    style = MaterialTheme.typography.titleSmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                Text(
                    text = userEmail,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.7f),
                    maxLines = 1,
                )
                // Level badge (where role badge was)
                if (levelLabel.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .padding(top = 4.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(GoldAccent.copy(alpha = 0.2f))
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                    ) {
                        Text(
                            text = levelLabel,
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                            color = GoldAccent,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // ── Notification bell icon ────────────────────────────
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.15f))
                    .clickable { onNotificationsClick() },
                contentAlignment = Alignment.Center,
            ) {
                if (unreadNotifications > 0) {
                    BadgedBox(
                        badge = {
                            Badge {
                                Text(
                                    text = if (unreadNotifications > 99) "99+" else "$unreadNotifications",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                                )
                            }
                        },
                    ) {
                        Icon(
                            Icons.Default.Notifications,
                            contentDescription = stringResource(R.string.notifications),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                } else {
                    Icon(
                        Icons.Default.Notifications,
                        contentDescription = stringResource(R.string.notifications),
                        tint = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // ── Right: Avatar with dropdown ────────────────────────
            Box {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(GoldAccent)
                        .clickable { showMenu = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initials,
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                    )
                }

                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false },
                ) {
                    // Role displayed at top of menu
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(badgeStyle.background)
                                        .padding(horizontal = 6.dp, vertical = 2.dp),
                                ) {
                                    Text(
                                        text = roleLabel,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = badgeStyle.text,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        },
                        onClick = { },
                        enabled = false,
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.settings_profile)) },
                        onClick = {
                            showMenu = false
                            onProfileClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Person, contentDescription = stringResource(R.string.cd_profile))
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.settings)) },
                        onClick = {
                            showMenu = false
                            onSettingsClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.cd_settings))
                        },
                    )
                    DropdownMenuItem(
                        text = {
                            Text(
                                stringResource(R.string.logout),
                                color = MaterialTheme.colorScheme.error,
                            )
                        },
                        onClick = {
                            showMenu = false
                            onLogoutClick()
                        },
                        leadingIcon = {
                            Icon(
                                Icons.AutoMirrored.Filled.Logout,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                        },
                    )
                }
            }
        }
    }
}
