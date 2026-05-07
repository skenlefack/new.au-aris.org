# ARIS Mobile - Android App

Offline-first Android application for AU-IBAR's Animal Resources Information System.
Field agents collect data across 55 Member States, even without connectivity.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Kotlin 1.9 |
| UI | Jetpack Compose + Material 3 |
| DI | Hilt 2.50 |
| HTTP | Ktor Client 2.3 |
| Database | Room 2.6 (SQLite) |
| Background | WorkManager 2.9 |
| Realtime | Socket.IO 2.1 |
| Maps | OSMDroid 6.1 (offline tiles) |
| Camera | CameraX 1.3 |
| Push | Firebase Cloud Messaging |
| Crash reporting | Firebase Crashlytics |
| Auth | JWT RS256 + MFA TOTP |
| Serialization | kotlinx-serialization |
| Security | EncryptedSharedPreferences (AES-256) |

**Min SDK:** 26 (Android 8.0) | **Target SDK:** 34 (Android 14)

## Architecture

```
MVVM + Clean Architecture + Offline-First

UI (Compose)
  |
ViewModel (Hilt-injected)
  |
Repository (single source of truth)
  |
  +-- Room DB (local cache / offline store)
  +-- Ktor API (remote server)
  +-- WebSocketManager (realtime events)

Background:
  WorkManager --> SyncWorker (15 min periodic)
             --> PhotoUploadWorker (on connectivity)
             --> CacheRefreshWorker (daily)
             --> CrashUploadWorker
```

## Project Structure

```
app/src/main/java/org/auibar/aris/mobile/
├── ArisApplication.kt          # Hilt app + WorkManager init
├── MainActivity.kt             # Single-activity Compose host
├── data/
│   ├── local/
│   │   ├── ArisDatabase.kt     # Room DB (11 entities, version 9)
│   │   ├── dao/                # 12 DAOs (SubmissionDao, CampaignDao, ...)
│   │   └── entity/             # Room entities
│   ├── remote/
│   │   ├── api/                # Ktor API services (Auth, Sync, Campaign, ...)
│   │   ├── dto/                # Serializable DTOs
│   │   └── websocket/          # Socket.IO WebSocketManager
│   ├── repository/             # Repositories (Auth, Sync, Submission, ...)
│   └── cache/                  # CachePolicy (TTL management)
├── di/                         # Hilt modules (NetworkModule, DatabaseModule)
├── service/                    # Firebase FCM, GPS tracking foreground service
├── sync/                       # WorkManager workers
├── ui/
│   ├── navigation/             # NavHost + routes
│   ├── theme/                  # Material 3 theme, colors, typography
│   ├── components/             # Reusable Compose components
│   ├── form/                   # Dynamic form engine (JSON Schema)
│   ├── charts/                 # Line, Pie, Bar, Sparkline charts
│   ├── login/                  # Login + MFA screens
│   ├── home/                   # Home dashboard
│   ├── campaign/               # Campaign list + detail
│   ├── submission/             # Submission list
│   ├── conflict/               # Sync conflict resolution
│   ├── health/                 # Animal Health (outbreaks, surveillance)
│   ├── livestock/              # Livestock (census, production)
│   ├── fisheries/              # Fisheries (captures, aquaculture)
│   ├── trade/                  # Trade & SPS (flows, certificates)
│   ├── wildlife/               # Wildlife (observations, HWC)
│   ├── apiculture/             # Apiculture (apiaries, colony health)
│   ├── governance/             # Governance (legal, vet capacity)
│   ├── climate/                # Climate (rangeland, water stress)
│   ├── paid/                   # PAID initiative dashboard + collecte
│   ├── knowledge/              # Knowledge Hub (articles, courses)
│   ├── message/                # Messaging (inbox, threads, compose)
│   ├── notification/           # Notification history
│   ├── map/                    # Offline maps + tile download
│   ├── gpstrack/               # GPS tracking visualization
│   ├── settings/               # Settings (language, server, sync)
│   └── lock/                   # PIN / biometric lock
└── util/                       # TokenManager, CrashLogger, PhotoCompressor, ...
```

## Setup

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34

### Build

```bash
# Debug build
cd apps/mobile
./gradlew assembleDebug

# Release build (requires keystore)
./gradlew assembleRelease
```

### Keystore Configuration

Create `apps/mobile/keystore.properties` (gitignored):
```properties
storeFile=release-keystore.jks
storePassword=your_password
keyAlias=aris
keyPassword=your_key_password
```

Or use environment variables: `ARIS_KEYSTORE_FILE`, `ARIS_KEYSTORE_PASSWORD`, `ARIS_KEY_ALIAS`, `ARIS_KEY_PASSWORD`.

### Server Environments

Configured in `build.gradle.kts` as BuildConfig fields:

| Environment | URL |
|-------------|-----|
| Production | `https://au-aris.org` |
| Staging | `https://test.au-aris.org` |
| Office/LAN | `https://10.202.101.183` |

Switchable at runtime in Settings screen.

## Offline-First Sync

1. **Data entry** - Forms filled offline, saved to Room as `PENDING`
2. **Background sync** - `SyncWorker` runs every 15 min (when connected + battery OK)
3. **Batch upload** - All pending submissions sent in one POST to `/api/v1/collecte/sync`
4. **Server response** - Each submission marked: `SYNCED`, `FAILED` (with errors), or `CONFLICT`
5. **Conflict resolution** - User compares local vs server version, resolves manually
6. **Referential refresh** - Species, diseases, geo units updated from server response
7. **Photo upload** - `PhotoUploadWorker` uploads photos separately via multipart to `/api/v1/drive/upload`

### Cache TTL

| Data Type | TTL |
|-----------|-----|
| Master data (species, diseases, geo) | 24 hours |
| Campaigns | 1 hour |
| Form templates | 6 hours |
| KPI / analytics | 5 minutes |

## Authentication

- JWT RS256 tokens stored in `EncryptedSharedPreferences`
- Automatic token refresh via Ktor Auth plugin (on 401)
- MFA/TOTP support (6-digit code)
- Optional PIN lock + biometric authentication at app launch
- Crashlytics user context set on login, cleared on logout

## Realtime

Socket.IO connection to the realtime service (port 3008):
- Subscribes to `tenant:{tenantId}` and `user:{userId}` rooms
- Events: `outbreak_alert`, `notification`, `sync_update`
- Exponential backoff reconnection (1s to 30s cap)
- Auto token refresh before reconnect

## Testing

```bash
# Unit tests
./gradlew testDebugUnitTest

# Instrumented tests (requires emulator/device)
./gradlew connectedDebugAndroidTest
```

### Test Structure

| Type | Location | Count |
|------|----------|-------|
| Unit tests | `src/test/` | ~25 files |
| Integration tests | `src/test/.../sync/` | 2 files (sync + photo) |
| Instrumented tests | `src/androidTest/` | 3 files (DB migration, form renderer, login UI) |

### Key Test Files

- `SyncIntegrationTest` - Full sync pipeline: batch, conflicts, referentials, workflow
- `PhotoUploadIntegrationTest` - Photo upload lifecycle, partial failures
- `SyncRepositoryTest` - Unit tests for sync logic
- `WebSocketManagerTest` - Backoff, connection states
- `AuthRepositoryTest` - Login, MFA, token management
- `FormSchemaParserTest` / `FormValidatorTest` - Form engine

## Conventions

- **Packages**: feature-based (`ui/health/`, `ui/fisheries/`, ...)
- **Naming**: `*Screen.kt` for Compose screens, `*ViewModel.kt` for ViewModels, `*Repository.kt` for data access
- **DI**: All ViewModels and repositories are `@Inject`-constructed via Hilt
- **Navigation**: Single `NavHost` with string routes, deep-link scheme `aris://`
- **Serialization**: `@Serializable` DTOs with kotlinx-serialization (not Gson)

## 9 Business Domains

All domains have dedicated screens for data collection:

| Domain | Screens |
|--------|---------|
| Animal Health | Outbreak Report, Surveillance Event |
| Livestock | Census, Production Record |
| Fisheries | Capture Record, Aquaculture Record |
| Trade & SPS | Trade Flow, SPS Certificate |
| Wildlife | Observation, Human-Wildlife Conflict |
| Apiculture | Apiary Record, Colony Health |
| Governance | Legal Framework, Vet Capacity |
| Climate | Rangeland, Water Stress |
| PAID | Dashboard, Collecte |
