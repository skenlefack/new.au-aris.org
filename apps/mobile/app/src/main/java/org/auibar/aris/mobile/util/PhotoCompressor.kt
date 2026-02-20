package org.auibar.aris.mobile.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PhotoCompressor @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        const val MAX_SIZE_BYTES = 1_000_000L // 1 MB
        const val MAX_DIMENSION = 1920
        const val INITIAL_QUALITY = 85
        const val MIN_QUALITY = 30
        const val QUALITY_STEP = 10
    }

    /**
     * Compress the given photo file to max 1MB.
     * Returns compressed file path and size, or original if already small enough.
     */
    fun compress(originalPath: String): CompressResult {
        val originalFile = File(originalPath)
        if (!originalFile.exists()) {
            return CompressResult(originalPath, originalFile.length(), false)
        }

        if (originalFile.length() <= MAX_SIZE_BYTES) {
            return CompressResult(originalPath, originalFile.length(), false)
        }

        // Read EXIF orientation before decoding
        val orientation = try {
            val exif = ExifInterface(originalPath)
            exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
        } catch (e: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }

        // Decode with sampling to reduce memory
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(originalPath, options)

        val sampleSize = calculateSampleSize(options.outWidth, options.outHeight)
        options.inJustDecodeBounds = false
        options.inSampleSize = sampleSize

        val bitmap = BitmapFactory.decodeFile(originalPath, options)
            ?: return CompressResult(originalPath, originalFile.length(), false)

        // Apply EXIF rotation
        val rotatedBitmap = applyOrientation(bitmap, orientation)

        // Scale down if still too large
        val scaledBitmap = scaleDown(rotatedBitmap)
        if (scaledBitmap !== rotatedBitmap && rotatedBitmap !== bitmap) {
            rotatedBitmap.recycle()
        }

        // Compress with decreasing quality until under 1MB
        val compressedFile = File(
            context.cacheDir,
            "compressed_${System.currentTimeMillis()}.jpg",
        )

        var quality = INITIAL_QUALITY
        while (quality >= MIN_QUALITY) {
            FileOutputStream(compressedFile).use { fos ->
                scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, fos)
            }
            if (compressedFile.length() <= MAX_SIZE_BYTES) {
                break
            }
            quality -= QUALITY_STEP
        }

        scaledBitmap.recycle()
        if (bitmap !== scaledBitmap) bitmap.recycle()

        // Copy EXIF GPS data to compressed file
        copyGpsExif(originalPath, compressedFile.absolutePath)

        return CompressResult(
            compressedFile.absolutePath,
            compressedFile.length(),
            true,
        )
    }

    /**
     * Extract GPS coordinates from EXIF data.
     */
    fun extractGpsFromExif(filePath: String): Pair<Double, Double>? {
        return try {
            val exif = ExifInterface(filePath)
            val latLong = FloatArray(2)
            if (exif.getLatLong(latLong)) {
                Pair(latLong[0].toDouble(), latLong[1].toDouble())
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Write GPS coordinates into EXIF metadata.
     */
    fun writeGpsToExif(filePath: String, lat: Double, lng: Double) {
        try {
            val exif = ExifInterface(filePath)
            exif.setLatLong(lat, lng)
            exif.saveAttributes()
        } catch (_: Exception) {
            // Best effort — don't crash if EXIF write fails
        }
    }

    private fun calculateSampleSize(width: Int, height: Int): Int {
        var sampleSize = 1
        while (width / sampleSize > MAX_DIMENSION * 2 ||
            height / sampleSize > MAX_DIMENSION * 2
        ) {
            sampleSize *= 2
        }
        return sampleSize
    }

    private fun scaleDown(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return bitmap

        val ratio = minOf(
            MAX_DIMENSION.toFloat() / width,
            MAX_DIMENSION.toFloat() / height,
        )
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
            else -> return bitmap
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated !== bitmap) bitmap.recycle()
        return rotated
    }

    private fun copyGpsExif(sourcePath: String, destPath: String) {
        try {
            val srcExif = ExifInterface(sourcePath)
            val dstExif = ExifInterface(destPath)

            val gpsTags = listOf(
                ExifInterface.TAG_GPS_LATITUDE,
                ExifInterface.TAG_GPS_LATITUDE_REF,
                ExifInterface.TAG_GPS_LONGITUDE,
                ExifInterface.TAG_GPS_LONGITUDE_REF,
                ExifInterface.TAG_GPS_ALTITUDE,
                ExifInterface.TAG_GPS_ALTITUDE_REF,
                ExifInterface.TAG_GPS_TIMESTAMP,
                ExifInterface.TAG_GPS_DATESTAMP,
            )
            for (tag in gpsTags) {
                srcExif.getAttribute(tag)?.let { dstExif.setAttribute(tag, it) }
            }
            dstExif.saveAttributes()
        } catch (_: Exception) {
            // Best effort
        }
    }

    data class CompressResult(
        val filePath: String,
        val sizeBytes: Long,
        val wasCompressed: Boolean,
    )
}
