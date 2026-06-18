package org.auibar.aris.mobile.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.data.repository.LoginResult
import org.auibar.aris.mobile.util.ConnectivityObserver
import org.auibar.aris.mobile.util.LocaleManager
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val mfaRequired: Boolean = false,
    val totpCode: String = "",
    val accountExpired: Boolean = false,
    val accountExpiredMessage: String? = null,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val webSocketManager: WebSocketManager,
    private val connectivityObserver: ConnectivityObserver,
    val localeManager: LocaleManager,
) : ViewModel() {

    val isOnline: StateFlow<Boolean> = connectivityObserver.isOnline
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        if (authRepository.isLoggedIn) {
            _uiState.value = _uiState.value.copy(isLoggedIn = true)
        }
    }

    fun onEmailChange(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }

    fun onPasswordChange(password: String) {
        _uiState.value = _uiState.value.copy(password = password, error = null)
    }

    fun onTotpCodeChange(code: String) {
        if (code.length <= 6 && code.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(totpCode = code, error = null)
        }
    }

    fun login() {
        val state = _uiState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _uiState.value = state.copy(error = "Email and password are required")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.login(state.email, state.password)) {
                is LoginResult.Success -> {
                    webSocketManager.connect()
                    _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                }
                is LoginResult.MfaRequired -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, mfaRequired = true)
                }
                is LoginResult.AccountExpired -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        accountExpired = true,
                        accountExpiredMessage = result.message,
                    )
                }
                is LoginResult.Error -> {
                    val msg = if (!isOnline.value) {
                        "No internet connection. Please check your network and try again."
                    } else {
                        result.message
                    }
                    _uiState.value = _uiState.value.copy(isLoading = false, error = msg)
                }
            }
        }
    }

    fun verifyMfa() {
        val state = _uiState.value
        if (state.totpCode.length != 6) {
            _uiState.value = state.copy(error = "Please enter the 6-digit code")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.verifyMfa(state.email, state.password, state.totpCode)) {
                is LoginResult.Success -> {
                    webSocketManager.connect()
                    _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                }
                is LoginResult.MfaRequired -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = "Invalid verification code")
                }
                is LoginResult.AccountExpired -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        accountExpired = true,
                        accountExpiredMessage = result.message,
                    )
                }
                is LoginResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    fun cancelMfa() {
        _uiState.value = _uiState.value.copy(
            mfaRequired = false,
            totpCode = "",
            error = null,
        )
    }
}
