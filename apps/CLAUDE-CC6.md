# CLAUDE.md — CC-6 Mobile Kotlin

## Your Scope
- `apps/mobile/` — Native Android app (Kotlin + Jetpack Compose)

## Purpose
Offline-first mobile app for field agents collecting health data across Africa.
Must work in areas with NO connectivity (rural, zones blanches).
Sync when connectivity returns (delta sync via collecte service).

## Tech Stack
- Kotlin 1.9+
- Jetpack Compose (Material 3) for UI
- Room (SQLite) for local database
- Hilt for dependency injection
- Ktor for HTTP client
- WorkManager for background sync
- CameraX for photo capture with GPS EXIF
- Play Services Location for GPS

## Architecture: MVVM + Repository + Offline-First
```
UI (Compose) → ViewModel → UseCase → Repository
                                        ├── LocalDataSource (Room)
                                        └── RemoteDataSource (Ktor → API)
```

### Offline Strategy
1. On login/sync: download campaigns, form templates, referentials (species, diseases, geo, denominators)
2. Store everything in Room database
3. User fills forms offline → saved to Room with status `DRAFT` or `PENDING_SYNC`
4. WorkManager periodically checks connectivity
5. When online: delta sync via `POST /collecte/sync`
6. Conflict resolution: last-write-wins (or flag for manual merge)

## Key Screens
1. **Login** — Email/password → JWT stored in EncryptedSharedPreferences
2. **Campaign List** — Active campaigns assigned to this agent
3. **Form Fill** — Dynamic form renderer from JSON Schema template
   - GPS auto-capture on open
   - Photo capture with compression
   - Species/disease selectors (from local Room cache of Master Data)
   - Admin cascader (Country → Admin1 → Admin2 → Admin3)
   - Offline indicator + save draft
4. **Submissions List** — My submissions with sync status indicators
5. **Sync Status** — Pending uploads, last sync time, force sync button
6. **Settings** — Language (FR/EN/AR/PT), offline data management, cache clear

## Room Database Schema
```kotlin
@Entity
data class CampaignEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String,
    val startDate: Long,
    val endDate: Long,
    val status: String,
    val syncedAt: Long?
)

@Entity
data class SubmissionEntity(
    @PrimaryKey val id: String,  // UUID generated locally
    val tenantId: String,
    val campaignId: String,
    val templateId: String,
    val data: String,            // JSON string
    val gpsLat: Double?,
    val gpsLng: Double?,
    val gpsAccuracy: Float?,
    val offlineCreatedAt: Long,
    val syncedAt: Long?,
    val syncStatus: String,      // PENDING | SYNCED | FAILED | CONFLICT
    val serverErrors: String?    // Quality gate errors JSON
)

@Entity
data class FormTemplateEntity(
    @PrimaryKey val id: String,
    val name: String,
    val domain: String,
    val schema: String,          // JSON Schema string
    val uiSchema: String,        // UI hints string
    val version: Int,
    val syncedAt: Long
)

// Master Data caches
@Entity data class SpeciesEntity(...)
@Entity data class DiseaseEntity(...)
@Entity data class GeoEntity(...)
@Entity data class DenominatorEntity(...)
```

## Sync Protocol
```kotlin
// Delta sync request
data class SyncRequest(
    val submissions: List<SubmissionDto>,  // New/updated since lastSyncAt
    val lastSyncAt: Long?
)

// Delta sync response
data class SyncResponse(
    val accepted: List<String>,     // Submission IDs accepted
    val rejected: List<RejectedSubmission>,  // With quality gate errors
    val conflicts: List<ConflictSubmission>,
    val updatedCampaigns: List<CampaignDto>,  // Campaigns changed server-side
    val updatedTemplates: List<FormTemplateDto>,
    val updatedReferentials: ReferentialUpdates
)
```

## Key Considerations
- Target devices: Android 8+ (API 26+), low-end devices (2GB RAM)
- APK size: minimize (no unnecessary libraries)
- Battery: efficient sync (WorkManager constraints: CONNECTED + BATTERY_NOT_LOW)
- Storage: efficient JSON storage, image compression before save
- Security: EncryptedSharedPreferences for tokens, Room with SQLCipher optional
- Language: FR/EN/AR/PT (string resources)

## Dependencies
```kotlin
// Compose
implementation("androidx.compose.material3:material3")
implementation("androidx.navigation:navigation-compose")
// DI
implementation("com.google.dagger:hilt-android")
// Network
implementation("io.ktor:ktor-client-android")
implementation("io.ktor:ktor-client-content-negotiation")
implementation("io.ktor:ktor-serialization-kotlinx-json")
// Database
implementation("androidx.room:room-runtime")
implementation("androidx.room:room-ktx")
// Background
implementation("androidx.work:work-runtime-ktx")
// Location
implementation("com.google.android.gms:play-services-location")
// Camera
implementation("androidx.camera:camera-camera2")
// Security
implementation("androidx.security:security-crypto")
// Testing
testImplementation("junit:junit")
testImplementation("io.mockk:mockk")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
```
