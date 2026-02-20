# Ktor
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class org.auibar.aris.mobile.**$$serializer { *; }
-keepclassmembers class org.auibar.aris.mobile.** {
    *** Companion;
}
-keepclasseswithmembers class org.auibar.aris.mobile.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Socket.IO
-keep class io.socket.** { *; }
-dontwarn io.socket.**
-keep class org.json.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *

# ── Coil ──
-keep class coil.** { *; }
-dontwarn coil.**

# ── Hilt / Dagger ──
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-dontwarn dagger.hilt.**

# ── WorkManager + Hilt ──
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.ListenableWorker
-keep class androidx.hilt.work.** { *; }

# ── Compose ──
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# ── Play Services Location ──
-keep class com.google.android.gms.location.** { *; }
-dontwarn com.google.android.gms.**

# ── Biometric ──
-keep class androidx.biometric.** { *; }

# ── CameraX ──
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ── Enum safety (for Kotlin enum serialization) ──
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Don't obfuscate crash reports ──
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
