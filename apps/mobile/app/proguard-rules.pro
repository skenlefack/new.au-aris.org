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
