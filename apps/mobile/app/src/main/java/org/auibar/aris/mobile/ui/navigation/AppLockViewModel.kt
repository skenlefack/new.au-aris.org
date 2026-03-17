package org.auibar.aris.mobile.ui.navigation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import org.auibar.aris.mobile.util.AppLockManager
import javax.inject.Inject

@HiltViewModel
class AppLockViewModel @Inject constructor(
    val appLockManager: AppLockManager,
) : ViewModel()
