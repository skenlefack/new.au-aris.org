package org.auibar.aris.mobile

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import org.auibar.aris.mobile.sync.CacheRefreshWorker
import org.auibar.aris.mobile.sync.SyncWorker
import org.auibar.aris.mobile.util.CrashLogger
import javax.inject.Inject

@HiltAndroidApp
class ArisApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        CrashLogger.install(this)
        SyncWorker.enqueue(this)
        CacheRefreshWorker.enqueue(this)
    }
}
