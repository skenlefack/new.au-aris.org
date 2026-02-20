package org.auibar.aris.mobile.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import org.auibar.aris.mobile.data.cache.MasterDataRefresher
import java.util.concurrent.TimeUnit

@HiltWorker
class CacheRefreshWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val masterDataRefresher: MasterDataRefresher,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Starting cache refresh...")
            masterDataRefresher.forceRefreshAll()
            Log.d(TAG, "Cache refresh complete")
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Cache refresh failed", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "CacheRefreshWorker"
        const val WORK_NAME = "aris_cache_refresh"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val request = PeriodicWorkRequestBuilder<CacheRefreshWorker>(
                24, TimeUnit.HOURS,
            ).setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
