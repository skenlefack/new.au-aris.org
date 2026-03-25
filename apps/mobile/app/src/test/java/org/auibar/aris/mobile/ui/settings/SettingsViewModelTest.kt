package org.auibar.aris.mobile.ui.settings

import android.content.Context
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.local.ArisDatabase
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.MessageDao
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.util.AppLockManager
import org.auibar.aris.mobile.util.LanguageOption
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.TokenManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var appContext: Context
    private lateinit var tokenManager: TokenManager
    private lateinit var localeManager: LocaleManager
    private lateinit var authRepository: AuthRepository
    private lateinit var database: ArisDatabase
    private lateinit var appLockManager: AppLockManager

    // Named DAO mocks for direct verification
    private lateinit var campaignDao: CampaignDao
    private lateinit var formTemplateDao: FormTemplateDao
    private lateinit var speciesDao: SpeciesDao
    private lateinit var diseaseDao: DiseaseDao
    private lateinit var geoDao: GeoDao
    private lateinit var notificationDao: NotificationDao
    private lateinit var messageDao: MessageDao
    private lateinit var submissionDao: SubmissionDao
    private lateinit var photoDao: PhotoDao

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        appContext = mockk(relaxed = true)
        val tempDir = File(System.getProperty("java.io.tmpdir"), "aris_test")
        tempDir.mkdirs()
        every { appContext.filesDir } returns tempDir
        every { appContext.cacheDir } returns tempDir
        tokenManager = mockk(relaxed = true)
        localeManager = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        database = mockk(relaxed = true)
        appLockManager = mockk(relaxed = true)

        every { tokenManager.userFullName } returns "Test User"
        every { tokenManager.userEmail } returns "test@au-aris.org"
        every { tokenManager.userRole } returns "FIELD_AGENT"
        every { tokenManager.tenantLevel } returns "MEMBER_STATE"
        every { tokenManager.syncFrequencyMinutes } returns 15
        every { tokenManager.lastSyncAt } returns 1700000000000
        every { localeManager.currentLanguage } returns "en"
        every { localeManager.supportedLanguages } returns listOf(
            LanguageOption("en", "English"),
            LanguageOption("fr", "Français"),
        )
        every { appLockManager.isPinEnabled } returns false

        // Named DAO mocks so coVerify works without chained calls
        campaignDao = mockk(relaxed = true)
        formTemplateDao = mockk(relaxed = true)
        speciesDao = mockk(relaxed = true)
        diseaseDao = mockk(relaxed = true)
        geoDao = mockk(relaxed = true)
        notificationDao = mockk(relaxed = true)
        messageDao = mockk(relaxed = true)
        submissionDao = mockk(relaxed = true)
        photoDao = mockk(relaxed = true)
        every { database.campaignDao() } returns campaignDao
        every { database.formTemplateDao() } returns formTemplateDao
        every { database.speciesDao() } returns speciesDao
        every { database.diseaseDao() } returns diseaseDao
        every { database.geoDao() } returns geoDao
        every { database.notificationDao() } returns notificationDao
        every { database.messageDao() } returns messageDao
        every { database.submissionDao() } returns submissionDao
        every { database.photoDao() } returns photoDao
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): SettingsViewModel {
        return SettingsViewModel(
            appContext,
            tokenManager,
            localeManager,
            authRepository,
            database,
            appLockManager,
        )
    }

    @Test
    fun `init populates state from token and locale managers`() = runTest {
        val vm = createViewModel()

        val state = vm.uiState.value
        assertEquals("Test User", state.userFullName)
        assertEquals("test@au-aris.org", state.userEmail)
        assertEquals("FIELD_AGENT", state.userRole)
        assertEquals("MEMBER_STATE", state.tenantLevel)
        assertEquals("en", state.currentLanguage)
        assertEquals(15, state.syncFrequencyMinutes)
        assertEquals(1700000000000, state.lastSyncAt)
        assertEquals(2, state.supportedLanguages.size)
        assertFalse(state.isPinEnabled)
    }

    @Test
    fun `setLanguage updates state and returns true on change`() = runTest {
        every { localeManager.currentLanguage } returns "en"
        val vm = createViewModel()

        val changed = vm.setLanguage("fr")

        assertTrue(changed)
        assertEquals("fr", vm.uiState.value.currentLanguage)
        verify { localeManager.setLanguage("fr") }
    }

    @Test
    fun `setLanguage returns false when same language`() = runTest {
        every { localeManager.currentLanguage } returns "en"
        val vm = createViewModel()

        val changed = vm.setLanguage("en")

        assertFalse(changed)
    }

    @Test
    fun `setSyncFrequency updates token and state`() = runTest {
        val vm = createViewModel()

        vm.setSyncFrequency(60)

        assertEquals(60, vm.uiState.value.syncFrequencyMinutes)
        verify { tokenManager.syncFrequencyMinutes = 60 }
    }

    @Test
    fun `clearCache clears reference tables and marks state`() = runTest {
        val vm = createViewModel()

        vm.clearCache()
        advanceUntilIdle()

        assertTrue(vm.uiState.value.cacheCleared)
        coVerify { campaignDao.deleteAll() }
        coVerify { formTemplateDao.deleteAll() }
        coVerify { speciesDao.deleteAll() }
        coVerify { diseaseDao.deleteAll() }
        coVerify { geoDao.deleteAll() }
        coVerify { notificationDao.deleteAll() }
        coVerify { messageDao.deleteAll() }
        coVerify { submissionDao.deleteSynced() }
        coVerify { photoDao.deleteUploaded() }
    }

    @Test
    fun `disablePin calls appLockManager and updates state`() = runTest {
        every { appLockManager.isPinEnabled } returns true
        val vm = createViewModel()
        assertTrue(vm.uiState.value.isPinEnabled)

        vm.disablePin()

        assertFalse(vm.uiState.value.isPinEnabled)
        verify { appLockManager.removePin() }
    }

    @Test
    fun `logout calls auth repository`() = runTest {
        val vm = createViewModel()

        vm.logout()

        verify { authRepository.logout() }
    }

    @Test
    fun `syncFrequencyOptions contains expected values`() = runTest {
        val vm = createViewModel()

        assertEquals(4, vm.syncFrequencyOptions.size)
        assertEquals(15, vm.syncFrequencyOptions[0].minutes)
        assertEquals(30, vm.syncFrequencyOptions[1].minutes)
        assertEquals(60, vm.syncFrequencyOptions[2].minutes)
        assertEquals(0, vm.syncFrequencyOptions[3].minutes)
    }
}
