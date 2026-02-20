# ADR-005: Kotlin + Jetpack Compose for Offline-First Mobile Application

## Status

Accepted

## Date

2024-06-01

## Context

ARIS 3.0 requires a mobile application for field data collection across 55 African countries. The mobile app serves the FIELD_AGENT role -- veterinary officers, livestock inspectors, fisheries observers, and wildlife rangers who collect data in the field and submit it to ARIS through the 4-level validation workflow. The mobile application has the following critical requirements:

1. **Offline-first operation:** Field agents frequently work in rural and remote areas with no cellular coverage or extremely limited bandwidth (2G/EDGE). The app must function fully offline: authenticate users, display assigned collection forms, capture data with validation, store submissions locally, and sync when connectivity returns. Offline periods can last days or weeks in some regions.

2. **Reliable data sync:** When connectivity is restored, the app must sync all locally stored submissions to the `collecte` service without data loss, handling conflict resolution for records that may have been modified on the server during the offline period. Sync must be resumable -- a partial sync interrupted by connectivity loss must resume from where it stopped, not restart.

3. **GPS and hardware integration:** Field data collection requires GPS coordinates (outbreak locations, holding positions, protected area boundaries), camera integration (photographic evidence of disease signs, market conditions), and potentially barcode scanning (sample identification, livestock tags). The app must access device hardware APIs reliably.

4. **Form rendering:** The `form-builder` service (CC-3) produces JSON Schema-based form definitions that the mobile app must render dynamically. Forms include conditional logic, repeating sections (e.g., multiple animals sampled), GPS capture fields, photo attachment fields, and offline-capable dropdown menus populated from cached master data.

5. **Performance on low-end devices:** Many field agents use budget Android devices (2-4 GB RAM, entry-level processors). The app must remain responsive on these devices even with thousands of cached records and large master data reference tables.

6. **Security:** The app stores sensitive data locally (outbreak reports, holding locations, personal information of livestock owners). Local storage must be encrypted, and biometric or PIN authentication must protect app access. JWT tokens must be verifiable offline using the RS256 public key (see ADR-004).

7. **Platform focus:** Android dominates the African mobile market with over 80% market share among the target user base. iOS support is not required for the initial release. A future iOS version may be considered if demand materializes from Member State administrations.

## Decision

We build the ARIS mobile application as a **native Android app using Kotlin with Jetpack Compose for UI and Room for local database storage**. The app is developed by CC-6 (Mobile Kotlin) as a dedicated module in the monorepo at `apps/mobile/`.

Key technical decisions:

**Language and UI framework:**
- **Kotlin** as the sole programming language, leveraging coroutines for asynchronous operations, Flow for reactive data streams, and sealed classes for exhaustive state modeling.
- **Jetpack Compose** for declarative UI, enabling efficient form rendering with dynamic components, conditional visibility, and repeating sections based on JSON Schema form definitions.
- Minimum SDK: Android API 26 (Android 8.0), covering 95%+ of active devices in target regions.

**Offline storage:**
- **Room** (SQLite abstraction) as the primary local database. Room provides compile-time query verification, migration support, and seamless integration with Kotlin coroutines and Flow.
- Database schema mirrors a subset of the server-side Prisma schemas: form definitions, master data lookups (species, diseases, administrative units), collected submissions, sync queue, and user profile/credentials.
- Room database is encrypted using SQLCipher, with the encryption key derived from the user's PIN and stored in Android Keystore.
- **Master data caching:** On first login and periodic sync, the app downloads relevant master data subsets (species taxonomy, disease codes, administrative boundaries for the user's assigned territory). This data is stored in Room and used for offline dropdown population and local validation.

**Sync engine:**
- A custom sync engine built on WorkManager (for guaranteed background execution) and Kotlin coroutines.
- Outbound sync: Locally captured submissions are queued in a `sync_queue` Room table with status tracking (PENDING, SYNCING, SYNCED, FAILED). The sync engine processes the queue FIFO, sending submissions to the `collecte` service REST API. Each submission is individually acknowledged -- partial sync is inherently supported.
- Inbound sync: Master data updates and form definition changes are pulled from the server using a last-sync timestamp. Conflict resolution follows a "server wins" policy for master data and a "last writer wins" policy for draft submissions.
- Sync status is displayed to the user with clear indicators: number of pending submissions, last successful sync time, and current connectivity state.

**Authentication:**
- JWT tokens from the credential service are stored in Android Keystore (hardware-backed on supported devices).
- Offline authentication: The app caches the RS256 public key and validates the JWT locally. If the access token is expired and no connectivity is available, the app enters a "limited offline mode" where data collection continues but sync is deferred.
- App access is protected by biometric authentication (fingerprint) or 6-digit PIN, enforced at app launch and after background timeout.

**Hardware integration:**
- GPS via Android Location Services (fused provider) with fallback to raw GPS when Google Play Services is unavailable.
- Camera via CameraX library for photo capture with automatic compression and EXIF metadata preservation.
- Network state monitoring via ConnectivityManager for adaptive sync behavior.

**Testing:**
- JUnit 5 for unit tests, MockK for mocking.
- Compose testing library for UI tests.
- Robolectric for tests that require Android framework APIs without a device.
- Integration tests use a local Room in-memory database.

## Consequences

### Positive

- **True offline capability:** Room (SQLite) provides a full relational database on-device, enabling complex queries, referential integrity, and transactional writes while offline. This is fundamentally more robust than browser-based storage (IndexedDB, localStorage) used by PWAs or cross-platform frameworks.
- **Hardware access:** Native Android development provides direct, reliable access to GPS, camera, filesystem, biometric APIs, and background execution (WorkManager) without bridge layers or plugins that may lag behind OS updates.
- **Performance on low-end devices:** Native Kotlin compiles to optimized Dalvik bytecode, consuming less memory and CPU than JavaScript-based cross-platform runtimes. Jetpack Compose's lazy composition model handles large form rendering efficiently on budget devices.
- **Compose declarative UI:** Jetpack Compose's declarative model maps naturally to JSON Schema-driven dynamic forms. Conditional field visibility, repeating sections, and validation state are expressed as composable functions reacting to state changes.
- **Ecosystem maturity:** Room, WorkManager, Kotlin coroutines, and Jetpack Compose are all first-party Google libraries with long-term support commitments, comprehensive documentation, and large developer communities.
- **Security:** Android Keystore provides hardware-backed key storage on most devices manufactured after 2018. SQLCipher encryption for Room is well-tested and certified. Native biometric integration uses the Android BiometricPrompt API.
- **Monorepo integration:** The Kotlin app at `apps/mobile/` shares `@aris/shared-types` definitions (via generated Kotlin data classes) with the TypeScript services, ensuring DTO consistency.

### Negative

- **Android only:** This decision limits the mobile app to Android, excluding iOS users. Given Android's dominant market share (80%+) in the target regions, this is an acceptable trade-off for the initial release. iOS support would require a separate development effort.
- **Kotlin expertise required:** CC-6 must have deep Kotlin and Android platform knowledge. Kotlin/Android developers are less abundant than JavaScript/TypeScript developers in some markets, potentially constraining team scaling.
- **No code sharing with web:** Unlike React Native (which shares code with Next.js) or Flutter (which could target web), native Kotlin shares no UI or business logic code with the Next.js web application. Form rendering logic and validation rules must be implemented separately on mobile and web.
- **App distribution:** Field agents must install the app from Google Play Store or enterprise sideloading (APK distribution). Updates require app store review or manual APK updates, unlike web apps that update instantly. This is mitigated by using in-app update prompts and maintaining backward-compatible APIs.
- **Build complexity:** The Android build system (Gradle) adds a different toolchain to the monorepo alongside Node.js/pnpm/Turborepo. CI/CD must accommodate both ecosystems.

### Neutral

- **Master data synchronization volume:** The initial master data download (species, diseases, administrative units for assigned territory) can be several megabytes. This is a one-time cost per login, with incremental updates thereafter. Field agents are expected to perform initial setup while connected to Wi-Fi.
- **Form definition evolution:** As the `form-builder` service evolves form schemas, the mobile app's JSON Schema renderer must keep pace. This is managed through schema versioning and backward-compatible field additions.

## Alternatives Considered

### React Native

A JavaScript-based cross-platform framework maintained by Meta. Rejected because: (1) React Native's SQLite support requires third-party libraries (e.g., react-native-sqlite-storage) that are less reliable and performant than Room, particularly for complex offline scenarios with thousands of queued records, (2) the JavaScript bridge introduces latency for GPS and camera operations that is noticeable on low-end devices, (3) background execution for sync (equivalent to WorkManager) requires native modules that negate the cross-platform benefit, (4) offline JWT validation requires a JavaScript RSA library rather than the platform's native cryptography, and (5) React Native's memory footprint is higher than native Kotlin on budget devices with 2-3 GB RAM.

### Flutter

Google's cross-platform UI toolkit using Dart. Rejected because: (1) Dart is a niche language with a smaller talent pool than Kotlin in Africa, (2) Flutter's SQLite support (sqflite) is less feature-rich than Room (no compile-time query verification, no built-in migration support, no reactive queries via Flow), (3) Flutter adds a significant binary size overhead (~15-20 MB for the engine alone), problematic for users on limited data plans and storage, (4) hardware API access requires platform channels that add complexity and potential points of failure, and (5) the team would need to maintain Dart type definitions separate from both TypeScript and Kotlin, tripling the type maintenance burden.

### Progressive Web App (PWA)

A web application using Service Workers for offline caching, installed on the home screen. Rejected because: (1) Service Workers and IndexedDB provide limited and unreliable offline storage compared to SQLite/Room -- storage can be evicted by the OS under memory pressure, (2) PWAs have no guaranteed background execution for sync (no equivalent to WorkManager), (3) GPS and camera access via web APIs is less reliable and feature-rich than native APIs, especially on older Android versions common in target regions, (4) PWAs cannot access Android Keystore for secure token storage, (5) offline periods lasting days or weeks exceed the practical limits of Service Worker cache reliability, and (6) many target devices run Android Go or older Chrome versions with incomplete PWA support.
