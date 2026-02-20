# ADR-007: Offline-First Mobile Architecture for Field Data Collection

## Status

Accepted

## Date

2024-06-01

## Context

ARIS field agents operate across 55 African Member States, frequently in rural and remote areas
where internet connectivity is intermittent, unreliable, or entirely absent. These agents collect
critical animal resource data including outbreak reports, vaccination records, census counts, and
trade inspections. Data collection cannot be contingent on network availability; agents must be able
to work for days or weeks without connectivity and synchronize when they reach a connected area.

The mobile application targets Android devices (dominant platform in Sub-Saharan Africa with over
80% market share). Field agents may share devices, operate in low-bandwidth environments (2G/EDGE),
and work in areas with frequent power outages. The application must handle GPS coordinate capture
for geo-tagging observations, support photo attachments for evidence documentation, and enforce
data quality rules locally before sync.

Key challenges include: (a) conflict resolution when the same record is modified on the device and
the server during an offline period, (b) ensuring data integrity when sync is interrupted mid-transfer,
(c) managing storage constraints on low-end devices, and (d) supporting multi-user scenarios where
a single device may be used by different field agents.

## Decision

We adopt an offline-first architecture for the Android mobile application (`apps/mobile`) built with
Kotlin, Jetpack Compose, and Room as the local database.

### Local Storage Layer

- **Room Database**: All collected data is persisted locally in a Room (SQLite) database before any
  network operations. The Room schema mirrors the server-side Prisma models with additional
  metadata columns: `syncStatus` (PENDING/SYNCED/CONFLICT/FAILED), `deviceId`, `localId`,
  `serverVersion`, and `lastSyncedAt`.
- **Attachment Storage**: Photos and documents are stored in the device's internal storage with
  references in Room. Files are compressed (JPEG quality 80, max 2048px) before sync to minimize
  bandwidth usage.
- **GPS Capture**: Coordinates are captured at the moment of data entry using the device's GPS
  hardware. Each record stores latitude, longitude, accuracy (meters), and capture timestamp.
  When GPS is unavailable, the agent can manually select a location from a cached map tile set.

### Delta Sync Protocol

Synchronization uses a delta sync approach to minimize data transfer:

1. **Outbound Sync (Device to Server)**: The device sends only records with `syncStatus = PENDING`,
   ordered by creation timestamp. Each batch contains up to 50 records. The server responds with
   an acknowledgment per record (accepted, conflict, or error).
2. **Inbound Sync (Server to Device)**: The device sends its `lastSyncedAt` timestamp. The server
   returns all records modified after that timestamp that belong to the agent's assigned area.
   Reference data (species lists, disease codes, administrative boundaries) is synced separately
   with versioned snapshots.
3. **Sync Endpoint**: A dedicated `/api/v1/collecte/sync` endpoint on the collecte service (3011)
   handles sync operations. The endpoint supports resumable transfers: if a sync is interrupted,
   the next attempt resumes from the last acknowledged record.

### Conflict Resolution

- **Default Strategy: Last-Write-Wins (LWW)**: When the same record is modified on both the device
  and the server, the version with the later timestamp wins. The losing version is preserved in a
  `conflict_archive` table for audit purposes.
- **Manual Merge Fallback**: When LWW produces a low-confidence resolution (e.g., both versions
  modified the same critical field like `diagnosisCode` or `speciesCount`), the record is flagged
  as CONFLICT and presented to the DATA_STEWARD for manual resolution via the web application.
- **Device ID Tracking**: Every record carries the originating `deviceId` to distinguish between
  changes from different devices and server-side modifications.

### Data Quality (Local)

The quality-rules package is compiled to a Kotlin-compatible format and embedded in the mobile app.
Basic quality gates (completeness, code validation, unit consistency) run locally before the record
is queued for sync. This ensures agents receive immediate feedback and can correct errors in the
field, even without connectivity.

### Security

- JWT tokens are cached locally with a configurable expiry (default: 7 days for offline scenarios).
- The local Room database is encrypted using SQLCipher.
- Device enrollment is required before first use, binding the device to a specific tenant.
- Remote wipe capability allows administrators to clear local data if a device is lost or stolen.

## Consequences

### Positive

- Field agents can collect data regardless of network availability, which is essential for rural
  African contexts.
- Delta sync minimizes bandwidth usage, making the app viable on 2G/EDGE connections.
- Local quality gate execution provides immediate feedback, improving data quality at the source.
- Conflict resolution preserves both versions, preventing data loss.
- Device ID tracking enables comprehensive audit trails for offline-collected data.

### Negative

- Room schema must be kept in sync with server-side Prisma models, creating a maintenance burden.
- LWW conflict resolution may silently overwrite important changes in rare edge cases.
- SQLCipher encryption adds approximately 15-25% overhead to database operations on low-end devices.
- 7-day JWT expiry for offline mode is a security trade-off; compromised tokens have a longer window.
- Reference data snapshots consume device storage, which may be limited on budget Android devices.

### Neutral

- The delta sync protocol is custom-built rather than using an off-the-shelf solution, which gives
  us full control but requires dedicated testing and maintenance.
- The mobile app is Android-only, reflecting the market reality in Sub-Saharan Africa.
  iOS support is deferred to a future phase.

## Alternatives Considered

1. **Firebase Offline (Firestore)**: Provides built-in offline support and conflict resolution.
   Rejected because it creates a dependency on Google Cloud infrastructure, which conflicts with
   AU-IBAR's data sovereignty requirements and the self-hosted infrastructure strategy.
2. **CouchDB/PouchDB Sync**: Mature offline-first sync protocol with automatic conflict detection.
   Rejected because PouchDB targets web/JavaScript runtimes, not native Android. CouchDB would
   add another database technology to the stack without clear benefits over PostgreSQL + Room.
3. **Custom WebSocket Sync**: Real-time bidirectional sync via WebSockets. Rejected because
   WebSockets require persistent connections, which is the opposite of what intermittent
   connectivity environments need. WebSocket sync is used for the web app (realtime service 3008)
   where connectivity is assumed.
4. **MQTT-based Sync**: Lightweight protocol designed for IoT and low-bandwidth environments.
   Considered viable but rejected in favor of HTTP-based delta sync because the team has deeper
   HTTP expertise and the existing API infrastructure supports REST natively.
