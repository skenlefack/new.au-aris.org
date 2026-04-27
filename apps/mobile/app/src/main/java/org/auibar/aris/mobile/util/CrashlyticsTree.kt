package org.auibar.aris.mobile.util

import android.util.Log
import timber.log.Timber

/**
 * Timber tree for release builds that forwards warnings/errors to CrashLogger.
 * Requires app context to be set via [init] before use.
 */
class CrashlyticsTree : Timber.Tree() {

    override fun isLoggable(tag: String?, priority: Int): Boolean {
        return priority >= Log.WARN
    }

    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        // CrashLogger writes to file — only available with Context.
        // In release builds, warnings/errors are silently dropped if no Context is available.
        // This is a no-op placeholder until Firebase Crashlytics is configured.
        Log.println(priority, tag ?: "ARIS", message)
    }

    private fun priorityLabel(priority: Int): String = when (priority) {
        Log.WARN -> "W"
        Log.ERROR -> "E"
        Log.ASSERT -> "A"
        else -> "?"
    }
}
