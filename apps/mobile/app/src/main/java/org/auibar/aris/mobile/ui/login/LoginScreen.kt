package org.auibar.aris.mobile.ui.login

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import org.auibar.aris.mobile.ui.components.LanguageSwitcher
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import org.auibar.aris.mobile.ui.theme.ErrorLight
import org.auibar.aris.mobile.util.LocaleManager

// AU Style Guide primary colours
private val AuCorporateGreen = Color(0xFF1A5632)
private val AuGreen = Color(0xFF348F41)
private val AuRed = Color(0xFF9F2241)
private val AuGold = Color(0xFFB4A269)
private val TextGrey = Color(0xFF58595B)

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
            // Clean AU gradient background (no bubbles, no arcs, no watermarks)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(AuCorporateGreen, AuGreen.copy(alpha = 0.9f)),
                        ),
                    ),
            )

            // Language switcher (top right)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp, end = 16.dp),
                contentAlignment = Alignment.TopEnd,
            ) {
                LanguageSwitcher(
                    localeManager = viewModel.localeManager,
                    tint = Color.White,
                    bgAlpha = 0.2f,
                )
            }

            // Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 28.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Spacer(modifier = Modifier.height(60.dp))

                // AU Logo
                Box(
                    modifier = Modifier
                        .shadow(8.dp, CircleShape)
                        .size(88.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.au_logo),
                        contentDescription = stringResource(R.string.cd_au_logo),
                        modifier = Modifier.size(64.dp),
                        contentScale = ContentScale.Fit,
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ARIS branding (clean typography, no "4.0")
                Text(
                    text = stringResource(R.string.aris_version),
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp,
                    ),
                    color = Color.White,
                )
                Text(
                    text = stringResource(R.string.app_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.75f),
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(36.dp))

                // Login card (solid, professional — no glassmorphic effect)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color.White.copy(alpha = 0.15f))
                        .padding(24.dp),
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
                    color = Color.White.copy(alpha = 0.5f),
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
            text = stringResource(R.string.sign_in_title),
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = stringResource(R.string.sign_in_subtitle),
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.7f),
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Email field
        OutlinedTextField(
            value = uiState.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text(stringResource(R.string.email), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = {
                Icon(Icons.Default.Email, contentDescription = stringResource(R.string.cd_email_field), tint = Color.White.copy(alpha = 0.7f))
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
            colors = loginFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Password field
        OutlinedTextField(
            value = uiState.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text(stringResource(R.string.password), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = {
                Icon(Icons.Default.Lock, contentDescription = stringResource(R.string.cd_password_field), tint = Color.White.copy(alpha = 0.7f))
            },
            trailingIcon = {
                IconButton(onClick = onTogglePasswordVisibility) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = if (passwordVisible) stringResource(R.string.hide_password) else stringResource(R.string.show_password),
                        tint = Color.White.copy(alpha = 0.7f),
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading,
            colors = loginFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Sign in button (AU Gold)
        val signingInDesc = stringResource(R.string.cd_signing_in)
        Button(
            onClick = viewModel::login,
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).height(50.dp),
            enabled = !uiState.isLoading,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AuGold,
                contentColor = Color.White,
                disabledContainerColor = AuGold.copy(alpha = 0.4f),
                disabledContentColor = Color.White.copy(alpha = 0.5f),
            ),
        ) {
            if (uiState.isLoading) {
                LoadingSpinner(modifier = Modifier.semantics { contentDescription = signingInDesc }, color = Color.White, size = 24.dp)
            } else {
                Text(stringResource(R.string.login), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
        }

        // Error
        uiState.error?.let { error ->
            val loginErrorDesc = stringResource(R.string.cd_login_error, error)
            Text(
                text = error, color = ErrorLight, style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 12.dp).semantics { liveRegion = LiveRegionMode.Assertive; contentDescription = loginErrorDesc },
            )
        }
    }
}

@Composable
private fun MfaContent(uiState: LoginUiState, viewModel: LoginViewModel) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.Shield, contentDescription = null, modifier = Modifier.size(48.dp), tint = AuGold)
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.mfa_title), style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.mfa_subtitle), style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f), textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = uiState.totpCode, onValueChange = viewModel::onTotpCodeChange,
            label = { Text(stringResource(R.string.mfa_code_label), color = Color.White.copy(alpha = 0.7f)) },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color.White.copy(alpha = 0.7f)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
            singleLine = true, modifier = Modifier.fillMaxWidth(), enabled = !uiState.isLoading,
            colors = loginFieldColors(), shape = RoundedCornerShape(12.dp),
        )

        Spacer(Modifier.height(24.dp))

        val verifyingDesc = stringResource(R.string.cd_verifying_code)
        Button(
            onClick = viewModel::verifyMfa, modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).height(50.dp),
            enabled = !uiState.isLoading, shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AuGold, contentColor = Color.White, disabledContainerColor = AuGold.copy(alpha = 0.4f)),
        ) {
            if (uiState.isLoading) LoadingSpinner(modifier = Modifier.semantics { contentDescription = verifyingDesc }, color = Color.White, size = 24.dp)
            else Text(stringResource(R.string.mfa_verify), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        }

        uiState.error?.let { error ->
            Text(error, color = ErrorLight, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 12.dp).semantics { liveRegion = LiveRegionMode.Assertive })
        }

        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.mfa_cancel), style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f),
            modifier = Modifier.clickable(enabled = !uiState.isLoading) { viewModel.cancelMfa() }.padding(8.dp))
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White, unfocusedTextColor = Color.White.copy(alpha = 0.9f),
    cursorColor = AuGold, focusedBorderColor = AuGold, unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
    focusedLabelColor = AuGold, unfocusedLabelColor = Color.White.copy(alpha = 0.5f),
    disabledTextColor = Color.White.copy(alpha = 0.4f), disabledBorderColor = Color.White.copy(alpha = 0.15f),
    disabledLabelColor = Color.White.copy(alpha = 0.3f),
)
