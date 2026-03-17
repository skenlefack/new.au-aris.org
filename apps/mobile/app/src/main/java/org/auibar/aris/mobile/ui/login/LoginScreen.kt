package org.auibar.aris.mobile.ui.login

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.AnimatedBubbles
import org.auibar.aris.mobile.ui.components.GlassmorphicCard
import org.auibar.aris.mobile.ui.components.GradientBackground
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import org.auibar.aris.mobile.ui.components.arisDomains
import org.auibar.aris.mobile.ui.theme.ErrorLight
import org.auibar.aris.mobile.ui.theme.GoldAccent
import org.auibar.aris.mobile.ui.theme.GoldAccentDark
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var passwordVisible by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoggedIn) {
        if (uiState.isLoggedIn) onLoginSuccess()
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = Color.Transparent,
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            // Layer 1: Animated gradient background
            GradientBackground()

            // Layer 2: Animals watermark image
            Image(
                painter = painterResource(id = R.drawable.animals),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize()
                    .alpha(0.12f),
                contentScale = ContentScale.Crop,
            )

            // Layer 3: Rotating circular arc decorations
            RotatingArcs()

            // Layer 4: Floating bubbles
            AnimatedBubbles()

            // Layer 5: Domain icon watermarks (very faint)
            DomainWatermark()

            // Layer 6: Content — logo + branding + glass card
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 28.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Spacer(modifier = Modifier.height(48.dp))

                // AU Logo in white circle with shadow
                Box(
                    modifier = Modifier
                        .shadow(16.dp, CircleShape)
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.au_logo),
                        contentDescription = stringResource(R.string.cd_au_logo),
                        modifier = Modifier.size(72.dp),
                        contentScale = ContentScale.Fit,
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ARIS 4.0 branding
                Text(
                    text = stringResource(R.string.aris_version),
                    style = MaterialTheme.typography.displaySmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 4.sp,
                    ),
                    color = Color.White,
                )
                Text(
                    text = stringResource(R.string.app_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.7f),
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Glassmorphic login card
                GlassmorphicCard(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 28.dp,
                    contentPadding = 28.dp,
                ) {
                    AnimatedContent(
                        targetState = uiState.mfaRequired,
                        transitionSpec = {
                            (slideInHorizontally { it } + fadeIn())
                                .togetherWith(slideOutHorizontally { -it } + fadeOut())
                        },
                        label = "loginMfaTransition",
                    ) { isMfa ->
                        if (isMfa) {
                            MfaContent(uiState = uiState, viewModel = viewModel)
                        } else {
                            LoginContent(
                                uiState = uiState,
                                viewModel = viewModel,
                                passwordVisible = passwordVisible,
                                onTogglePasswordVisibility = { passwordVisible = !passwordVisible },
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Powered by AU-IBAR
                Text(
                    text = stringResource(R.string.powered_by_au_ibar),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.4f),
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(48.dp))
            }
        }
    }
}

@Composable
private fun LoginContent(
    uiState: LoginUiState,
    viewModel: LoginViewModel,
    passwordVisible: Boolean,
    onTogglePasswordVisibility: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.welcome_back),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = stringResource(R.string.sign_in_title),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.7f),
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Email field
        OutlinedTextField(
            value = uiState.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text(stringResource(R.string.email), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = {
                Icon(
                    Icons.Default.Email,
                    contentDescription = stringResource(R.string.cd_email_field),
                    tint = Color.White.copy(alpha = 0.7f),
                )
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
            colors = loginFieldColors(),
            shape = RoundedCornerShape(14.dp),
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Password field
        OutlinedTextField(
            value = uiState.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text(stringResource(R.string.password), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = stringResource(R.string.cd_password_field),
                    tint = Color.White.copy(alpha = 0.7f),
                )
            },
            trailingIcon = {
                IconButton(onClick = onTogglePasswordVisibility) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility,
                        contentDescription = if (passwordVisible) stringResource(R.string.hide_password)
                        else stringResource(R.string.show_password),
                        tint = Color.White.copy(alpha = 0.7f),
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None
            else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
            colors = loginFieldColors(),
            shape = RoundedCornerShape(14.dp),
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Gold accent sign-in button
        val signingInDesc = stringResource(R.string.cd_signing_in)
        Button(
            onClick = viewModel::login,
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 48.dp)
                .height(52.dp),
            enabled = !uiState.isLoading,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = GoldAccent,
                contentColor = Color.White,
                disabledContainerColor = GoldAccentDark.copy(alpha = 0.5f),
                disabledContentColor = Color.White.copy(alpha = 0.5f),
            ),
        ) {
            if (uiState.isLoading) {
                LoadingSpinner(
                    modifier = Modifier.semantics {
                        contentDescription = signingInDesc
                    },
                    color = Color.White,
                    size = 24.dp,
                )
            } else {
                Text(
                    text = stringResource(R.string.login),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
            }
        }

        // Error text
        uiState.error?.let { error ->
            val loginErrorDesc = stringResource(R.string.cd_login_error, error)
            Text(
                text = error,
                color = ErrorLight,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .semantics {
                        liveRegion = LiveRegionMode.Assertive
                        contentDescription = loginErrorDesc
                    },
            )
        }
    }
}

@Composable
private fun MfaContent(
    uiState: LoginUiState,
    viewModel: LoginViewModel,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Shield icon
        Icon(
            imageVector = Icons.Default.Shield,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = GoldAccent,
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.mfa_title),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.mfa_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.7f),
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(28.dp))

        // TOTP code field
        OutlinedTextField(
            value = uiState.totpCode,
            onValueChange = viewModel::onTotpCodeChange,
            label = { Text(stringResource(R.string.mfa_code_label), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.7f),
                )
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done,
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
            colors = loginFieldColors(),
            shape = RoundedCornerShape(14.dp),
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Verify button
        val verifyingDesc = stringResource(R.string.cd_verifying_code)
        Button(
            onClick = viewModel::verifyMfa,
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 48.dp)
                .height(52.dp),
            enabled = !uiState.isLoading,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = GoldAccent,
                contentColor = Color.White,
                disabledContainerColor = GoldAccentDark.copy(alpha = 0.5f),
                disabledContentColor = Color.White.copy(alpha = 0.5f),
            ),
        ) {
            if (uiState.isLoading) {
                LoadingSpinner(
                    modifier = Modifier.semantics {
                        contentDescription = verifyingDesc
                    },
                    color = Color.White,
                    size = 24.dp,
                )
            } else {
                Text(
                    text = stringResource(R.string.mfa_verify),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
            }
        }

        // Error text
        uiState.error?.let { error ->
            val verificationErrorDesc = stringResource(R.string.cd_verification_error, error)
            Text(
                text = error,
                color = ErrorLight,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .semantics {
                        liveRegion = LiveRegionMode.Assertive
                        contentDescription = verificationErrorDesc
                    },
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Cancel / Back to login
        Text(
            text = stringResource(R.string.mfa_cancel),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.7f),
            modifier = Modifier
                .clickable(enabled = !uiState.isLoading) { viewModel.cancelMfa() }
                .padding(8.dp),
        )
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White.copy(alpha = 0.9f),
    cursorColor = GoldAccent,
    focusedBorderColor = GoldAccent,
    unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
    focusedLabelColor = GoldAccent,
    unfocusedLabelColor = Color.White.copy(alpha = 0.5f),
    disabledTextColor = Color.White.copy(alpha = 0.4f),
    disabledBorderColor = Color.White.copy(alpha = 0.15f),
    disabledLabelColor = Color.White.copy(alpha = 0.3f),
)

@Composable
private fun RotatingArcs() {
    val transition = rememberInfiniteTransition(label = "arcs")
    val rotation1 by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(12_000, easing = LinearEasing)),
        label = "arc1",
    )
    val rotation2 by transition.animateFloat(
        initialValue = 360f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(16_000, easing = LinearEasing)),
        label = "arc2",
    )
    val rotation3 by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(20_000, easing = LinearEasing)),
        label = "arc3",
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        val cx = size.width / 2
        val cy = size.height * 0.32f

        // Arc 1 — large outer ring (clearly visible)
        drawArc(
            color = Color.White.copy(alpha = 0.15f),
            startAngle = rotation1,
            sweepAngle = 120f,
            useCenter = false,
            topLeft = Offset(cx - 200f, cy - 200f),
            size = androidx.compose.ui.geometry.Size(400f, 400f),
            style = Stroke(width = 4f, cap = StrokeCap.Round),
        )
        // Arc 2 — mid ring (counter-rotating)
        drawArc(
            color = Color.White.copy(alpha = 0.12f),
            startAngle = rotation2,
            sweepAngle = 90f,
            useCenter = false,
            topLeft = Offset(cx - 155f, cy - 155f),
            size = androidx.compose.ui.geometry.Size(310f, 310f),
            style = Stroke(width = 3f, cap = StrokeCap.Round),
        )
        // Arc 3 — inner ring
        drawArc(
            color = Color.White.copy(alpha = 0.10f),
            startAngle = rotation3,
            sweepAngle = 150f,
            useCenter = false,
            topLeft = Offset(cx - 110f, cy - 110f),
            size = androidx.compose.ui.geometry.Size(220f, 220f),
            style = Stroke(width = 2.5f, cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun DomainWatermark() {
    val transition = rememberInfiniteTransition(label = "watermark")
    val offset by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(30_000, easing = LinearEasing)),
        label = "watermarkDrift",
    )

    Canvas(modifier = Modifier
        .fillMaxSize()
        .alpha(0.06f)) {
        val cx = size.width / 2
        val cy = size.height * 0.32f
        val radius = 175f

        arisDomains.forEachIndexed { index, domain ->
            val angle = Math.toRadians((index * 40.0 + offset).toDouble())
            val x = cx + (cos(angle) * radius).toFloat()
            val y = cy + (sin(angle) * radius).toFloat()

            drawCircle(
                color = domain.color,
                radius = 18f,
                center = Offset(x, y),
            )
        }
    }
}
