package org.auibar.aris.mobile.util

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CrashLogger {
    private const val TAG = "CrashLogger"
    private const val LOG_DIR = "crash_logs"
    private const val MAX_LOGS = 10

    fun install(context: Context) {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                writeLog(context, throwable)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to write crash log", e)
            }
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    fun writeLog(context: Context, throwable: Throwable) {
        val dir = File(context.filesDir, LOG_DIR).apply { mkdirs() }
        val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US)
        val file = File(dir, "crash_${dateFormat.format(Date())}.log")

        PrintWriter(FileWriter(file)).use { pw ->
            pw.println("Time: ${Date()}")
            pw.println("Message: ${throwable.message}")
            pw.println("---")
            throwable.printStackTrace(pw)
        }

        // Keep only last MAX_LOGS files
        val logs = dir.listFiles()?.sortedByDescending { it.lastModified() } ?: return
        logs.drop(MAX_LOGS).forEach { it.delete() }
    }

    fun getLogFiles(context: Context): List<File> {
        val dir = File(context.filesDir, LOG_DIR)
        return dir.listFiles()?.sortedByDescending { it.lastModified() }?.toList() ?: emptyList()
    }
}
