# Changelog

All notable changes to the ARIS 3.0 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0-rc1] - 2026-02-22

### Added

- **PgBouncer integration** for PostgreSQL connection pooling
  - Transaction pooling mode with 500 max client connections
  - Prisma compatibility via `?pgbouncer=true` and `ignore_startup_parameters`
  - Docker Compose service (`edoburu/pgbouncer`) with health checks
  - `infrastructure/pgbouncer/` configuration files (`pgbouncer.ini`, `userlist.txt`)
- **`@aris/cache` package** -- centralized Redis cache with domain-aware features
  - `CacheService` with `get`, `set`, `getOrSet`, `del`, `exists`, hash operations
  - Domain-aware key patterns: `{prefix}{domain}:{entity}:{id}`
  - Configurable TTL per domain (master-data: 1h, query results: 5min, dashboards: 2min)
  - Kafka-driven cache invalidation via `CacheInvalidationService`
  - Distributed locks (`acquireLock`, `releaseLock`) for concurrent operations
  - `MockCacheService` for unit testing
  - NestJS module with `forRoot()` and `forRootAsync()` configuration
  - 43 tests passing
- **Institutional landing page** with 3 levels of public navigation
  - Continental page: 8 REC cards, continental stats, 9 business domain icons, contextual login panel
  - REC page (`/rec/[code]`): member state flags, regional statistics
  - Country page (`/country/[code]`): national KPIs, sector performance, REC memberships
  - Data configuration for all 55 AU Member States (`countries-config.ts`) and 8 RECs (`recs-config.ts`)
- **Prisma 6.2.0 migration** from Prisma 5.x for Node.js 22 compatibility
- **CORS enabled** on all backend services (`enableCors({ origin: true, credentials: true })`)
- **JWT key loading from PEM files** (`keys/private.pem`, `keys/public.pem`) with inline env fallback
- **NestJS module naming** conflict resolution (`AuthModule` renamed to `CredentialAuthModule`)
- **Complete API routes catalogue** (`docs/api/ROUTES.md`) documenting 300+ endpoints across 22 services

### Changed

- `DATABASE_URL` now routes through PgBouncer (port 6432) with `?pgbouncer=true` parameter
- Prisma schema uses `directUrl` for migrations (direct PostgreSQL connection on port 5432)
- Credential service routes restructured to `api/v1/credential/auth/*` and `api/v1/credential/users/*`
- Tech stack upgraded: Node.js 22, Prisma 6.2, with esbuild-compatible `@Inject()` decorators

### Infrastructure

- Docker Compose: added `pgbouncer` service (image: `edoburu/pgbouncer:latest`)
- Docker Compose: added Prometheus (`prom/prometheus:v2.51.2`) and Grafana (`grafana/grafana:10.4.2`)
- `infrastructure/pgbouncer/pgbouncer.ini` with transaction pooling configuration
- `infrastructure/pgbouncer/userlist.txt` for MD5 authentication
- New environment variables: `PGBOUNCER_PORT`, `DATABASE_URL` (PgBouncer), `DIRECT_DATABASE_URL` (direct)

### Documentation

- Created `README.md` -- comprehensive project overview with badges, architecture, quick start
- Created `ARCHITECTURE.md` -- high-level architecture synthesis with Mermaid diagrams
- Created `docs/architecture/CACHE-STRATEGY.md` -- Redis cache architecture
- Created `docs/architecture/PGBOUNCER.md` -- connection pooling documentation
- Created `docs/api/ROUTES.md` -- complete API routes catalogue
- Updated `docs/architecture/OVERVIEW.md` -- added PgBouncer, Redis cache, landing page sections
- Updated `docs/architecture/DEPLOYMENT.md` -- PgBouncer configuration, dual DATABASE_URL
- Updated `docs/architecture/SECURITY.md` -- PgBouncer security, JWT PEM loading, module naming
- Updated `CLAUDE.md` -- new packages, routes, infrastructure, conventions

---

## [0.2.0-beta] - 2026-02-20

### Added

- **Complete CI/CD pipeline** with GitHub Actions (build, test, lint, deploy)
- **Prometheus + Grafana monitoring** dashboards for service health and KPIs
- **Internationalization** (i18n) for 4 languages: English, French, Portuguese, Arabic (with RTL support)
  - `@aris/i18n` package with enum translations and locale management
  - Web app locale switcher and message bundles (`en.json`, `fr.json`, `pt.json`)
- **Dark mode support** across the web application with Tailwind CSS dark variant
- **PWA capabilities** for the web application (service worker, manifest)
- **Cross-domain analytics engine** (`services/analytics/src/cross-domain/`)
  - Correlations, risk scores, livestock population, fisheries catches
  - Trade balance, wildlife crime trends, climate alerts, PVS scores
- **Notification templates** with Handlebars templating engine and multi-language support
  - Template engine for email, SMS, push, and in-app notifications
  - Digest service for batching notifications
- **Security hardening**
  - MFA TOTP enrollment, verification, and disable flows
  - Biometric auth support in mobile app
  - Rate limiting with configurable windows per endpoint
  - Account lockout after failed login attempts
- **1,400+ master data seed records**
  - 55 AU Member States with administrative hierarchies
  - Species taxonomy (domestic, wildlife, aquatic)
  - WOAH disease list with WAHIS-aligned codes
  - Standard units, identifiers, denominators

### Changed

- Admin panel enhanced with user management, tenant administration, and system monitoring
- Mobile app: offline maps support and background sync improvements
- Message service: Kafka consumer for async notification processing

---

## [0.1.0-alpha] - 2026-02-18

### Added

- **Initial microservices architecture** with 22 NestJS backend services
  - Platform services: tenant, credential, message, drive, realtime
  - Data hub: master-data, data-quality, data-contract, interop-hub
  - Collecte & workflow: form-builder, collecte, workflow
  - Domain services: animal-health, livestock-prod, fisheries, wildlife, apiculture, trade-sps, governance, climate-env
  - Data & integration: analytics, geo-services, knowledge-hub
- **Apache Kafka event bus** with 3 KRaft brokers (no ZooKeeper)
  - 36 pre-configured topics with replication factor 3
  - Schema Registry for Avro/JSON Schema governance
  - Dead Letter Queues (DLQ) for failed message processing
- **PostgreSQL 16 + PostGIS 3.4** with 22 per-service schemas
  - Prisma ORM with multi-schema support
  - PostGIS spatial extensions for geographic data
  - UUID-OSSP and pg_trgm extensions
- **Core shared packages**
  - `@aris/shared-types` -- TypeScript types, DTOs, enums, Kafka contracts
  - `@aris/kafka-client` -- generic producer/consumer with DLQ
  - `@aris/auth-middleware` -- JWT RS256 validation, RBAC guards, tenant extraction
  - `@aris/db-schemas` -- Prisma schemas and migrations
  - `@aris/quality-rules` -- data quality gate definitions
  - `@aris/ui-components` -- React Design System (Shadcn/UI + Tailwind)
  - `@aris/test-utils` -- test factories and Testcontainers helpers
  - `@aris/service-clients` -- inter-service HTTP clients
  - `@aris/observability` -- Prometheus metrics and structured logging
- **Web application** (Next.js 14 App Router)
  - 51+ pages covering all 9 business domains
  - Authentication flow (login, register, password reset)
  - Dashboard with real-time statistics
  - Data entry forms with validation
  - Export capabilities (CSV, PDF)
- **Admin panel** (Next.js 14)
  - 15 pages for system administration
  - User management, tenant configuration
  - Service monitoring
- **Mobile application** (Kotlin + Jetpack Compose)
  - Offline-first architecture with Room database
  - Background sync with delta updates
  - Barcode scanning and GPS capture
  - Field data collection forms
- **Docker Compose infrastructure**
  - Kafka KRaft cluster (3 brokers)
  - PostgreSQL + PostGIS
  - Redis 7 (cache, sessions, pub/sub)
  - Elasticsearch 8 (search)
  - MinIO (S3-compatible object storage)
  - Mailpit (email testing)
  - Traefik v3 (API gateway)
  - Kafka UI and Schema Registry
- **4-level validation workflow** (Annex B SS B4.1)
  - L1: National technical validation (quality gates)
  - L2: National official approval (CVO/WAHIS-ready)
  - L3: REC harmonization (cross-border consistency)
  - L4: Continental publication (analytics, dashboards)
- **8 data quality gates** (Annex B SS B4.2)
  - Completeness, temporal consistency, geographic consistency
  - Code validation, unit validation, deduplication
  - Auditability, confidence scoring
- **RBAC with 8 roles**
  - SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN
  - DATA_STEWARD, WAHIS_FOCAL_POINT, ANALYST, FIELD_AGENT
- **Multi-tenant hierarchy** (Continental > REC > Member State)
  - Tenant isolation in every database query
  - Hierarchical data access (parent sees children)
- **Audit trail** for every data mutation
  - Actor, timestamp, action, reason, data classification
  - Previous and new version snapshots

### Infrastructure

- Turborepo + pnpm workspaces monorepo configuration
- Docker Compose with named volumes and health checks
- Kafka topic initializer (one-shot container)
- Database initialization SQL script (extensions, schemas, audit table)
- JWT RS256 key generation script

---

[0.3.0-rc1]: https://github.com/AU-IBAR/aris/compare/v0.2.0-beta...v0.3.0-rc1
[0.2.0-beta]: https://github.com/AU-IBAR/aris/compare/v0.1.0-alpha...v0.2.0-beta
[0.1.0-alpha]: https://github.com/AU-IBAR/aris/releases/tag/v0.1.0-alpha
