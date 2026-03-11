# ARIS 4.0 — Animal Resources Information System
# AU-IBAR Continental Digital Infrastructure

## Project Overview
ARIS is the **digital backbone** of the African Union's Inter-African Bureau for Animal Resources (AU-IBAR).
It is a federated System-of-Systems covering ALL animal resources across 55 Member States and 8 RECs.
Aligned with: AU Agenda 2063, LiDeSA, PFRS, AU Digital Transformation Strategy 2020–2030.

### Scope — 9 Business Domains
1. **Governance & Capacities** — Legal frameworks, veterinary services, PVS metrics
2. **Animal Health & One Health** — Surveillance, outbreaks, lab, vaccination, AMR
3. **Production & Pastoralism** — Census, production systems, transhumance corridors
4. **Trade, Markets & SPS** — Trade flows, SPS certification, market intelligence (AfCFTA)
5. **Fisheries & Aquaculture** — Captures, fleet, licenses, aquaculture, aquatic health
6. **Wildlife & Biodiversity** — Inventories, protected areas, CITES, human-wildlife conflict
7. **Apiculture & Pollination** — Apiaries, honey production, colony health
8. **Climate & Environment** — Water stress, rangelands, GHG, vulnerability hotspots
9. **Knowledge Management** — Portal, e-repository, e-learning, briefs, MEL

### Architecture Principles (from AU-IBAR Strategic Plan 2024–2028)
- **Federated subsidiarity**: Data produced/validated at country level. ARIS consolidates at REC/continental.
- **Report once, use many**: Single entry at country → WAHIS, EMPRES, FAOSTAT, dashboards, CAADP.
- **Interoperability by design**: Master Data (geo/species/diseases/units), data contracts, audit trail.
- **Official vs Analytical distinction**: WAHIS notifications = national sovereignty. Dashboards = provenance + disclaimers.
- **Production-grade from day 1**: HA/DR, RBAC, MFA, audit trail, backups, firewalls, incident response.

## Tech Stack
- **Runtime**: Node.js 22 LTS
- **Backend**: NestJS 10 + TypeScript 5 (strict mode)
- **Mobile**: Kotlin + Jetpack Compose + Room (offline-first)
- **Frontend**: Next.js 14 (App Router) + React 18 + Shadcn/UI + Tailwind CSS
- **ORM**: Prisma 6.2 (multi-schema, type-safe)
- **Message Broker**: Apache Kafka (KRaft mode, no ZooKeeper) + Schema Registry
- **Database**: PostgreSQL 16 + PostGIS 3.4
- **Connection Pool**: PgBouncer (transaction pooling, port 6432)
- **Cache**: Redis 7 + `@aris/cache` (domain-aware keys, TTL, Kafka invalidation, distributed locks)
- **Search**: OpenSearch 2 (Apache 2.0, replaces Elasticsearch)
- **Object Storage**: MinIO (S3-compatible)
- **API Gateway**: Traefik v3 (port 4000)
- **Geo Services**: PostGIS + pg_tileserv (vector tiles)
- **BI**: Apache Superset + Metabase (embedded)
- **Analytics**: Kafka Streams + Trino
- **Auth**: Custom JWT RS256 + bcrypt + MFA TOTP (no external IdP dependency)
- **Monitoring**: Prometheus + Grafana
- **i18n**: EN, FR, PT, AR (RTL support) via `@aris/i18n`
- **Infra**: Docker + Kubernetes + Terraform
- **CI/CD**: GitHub Actions + ArgoCD
- **Tests**: Vitest + Testcontainers (TS) / JUnit + MockK (Kotlin)
- **Monorepo**: Turborepo + pnpm workspaces

## Monorepo Structure
```
aris/
├── CLAUDE.md                          # THIS FILE — global context
├── package.json                       # pnpm workspace root
├── turbo.json                         # Turborepo config
├── docker-compose.yml                 # Kafka, PG, Redis, ES, MinIO, Mailpit
├── .env.example                       # Environment template
│
├── packages/                          # Shared libraries (CC-1 owns)
│   ├── shared-types/                  # TS types, DTOs, Kafka contracts, enums
│   ├── kafka-client/                  # Generic Kafka producer/consumer + DLQ
│   ├── auth-middleware/               # JWT RS256 validation + RBAC + tenantId extraction
│   ├── cache/                         # Redis cache: domain-aware keys, TTL, Kafka invalidation, locks
│   ├── i18n/                          # Internationalization (EN, FR, PT, AR with RTL)
│   ├── db-schemas/                    # Prisma schemas + migrations (one per service)
│   ├── ui-components/                 # Design System React (Shadcn + Tailwind)
│   ├── service-clients/               # Inter-service HTTP clients (retry, circuit breaker)
│   ├── observability/                 # Prometheus metrics, structured logging
│   ├── quality-rules/                 # Shared data quality gate definitions
│   └── test-utils/                    # Factories, Testcontainers helpers
│
├── services/                          # Backend microservices (NestJS)
│   │
│   │  ── Platform (CC-1) ──
│   ├── tenant/                        # 3001 — Multi-tenant hierarchy (AU→REC→MS)
│   ├── credential/                    # 3002 — Auth JWT RS256, RBAC, MFA, rate limiting
│   ├── message/                       # 3006 — Notifications (SMS, email, push, in-app)
│   ├── drive/                         # 3007 — Document storage (MinIO S3)
│   ├── realtime/                      # 3008 — WebSocket sync
│   │
│   │  ── Data Hub (CC-2) ──
│   ├── master-data/                   # 3003 — Dictionary: geo, species, diseases, units, IDs
│   ├── data-quality/                  # 3004 — Quality gates, confidence scoring, correction loop
│   ├── data-contract/                 # 3005 — Contract registry (schema, frequency, SLA)
│   ├── interop-hub/                   # 3032 — WAHIS/EMPRES/FAOSTAT/FishStatJ/CITES connectors
│   │
│   │  ── Collecte & Workflow (CC-3) ──
│   ├── form-builder/                  # 3010 — No-Code form builder (JSON Schema)
│   ├── collecte/                      # 3011 — Campaign orchestration, offline sync
│   ├── workflow/                      # 3012 — 4-level validation engine
│   │
│   │  ── Domain Services (CC-4) ──
│   ├── animal-health/                 # 3020 — Outbreaks, surveillance, lab, vaccination, AMR
│   ├── livestock-prod/                # 3021 — Census, production, slaughter, transhumance
│   ├── fisheries/                     # 3022 — Captures, fleet, aquaculture
│   ├── wildlife/                      # 3023 — Inventories, protected areas, CITES
│   ├── apiculture/                    # 3024 — Apiaries, production, colony health
│   ├── trade-sps/                     # 3025 — Trade flows, SPS certification, markets
│   ├── governance/                    # 3026 — Legal frameworks, capacities, PVS
│   ├── climate-env/                   # 3027 — Water stress, rangelands, hotspots
│   │
│   │  ── Data & Integration (CC-4) ──
│   ├── analytics/                     # 3030 — Kafka Streams, KPIs, denominators
│   ├── geo-services/                  # 3031 — PostGIS, pg_tileserv, risk layers
│   └── knowledge-hub/                 # 3033 — Portal, e-repository, e-learning
│
├── apps/                              # Frontend applications
│   ├── web/                           # CC-5 — Next.js 14 main app
│   ├── admin/                         # CC-5 — Admin panel
│   └── mobile/                        # CC-6 — Kotlin Android app
│
├── infrastructure/                    # PgBouncer config
│   └── pgbouncer/                     # pgbouncer.ini, userlist.txt
├── infra/                             # Prometheus, Grafana, SQL init
│   ├── prometheus/                    # prometheus.yml, alert-rules.yml
│   ├── grafana/                       # Dashboards, provisioning
│   └── init-databases.sql            # 22 schemas + extensions
└── docs/                              # Architecture, ADRs, runbooks
    ├── architecture/                  # OVERVIEW, DEPLOYMENT, SECURITY, CACHE-STRATEGY, PGBOUNCER
    └── api/                           # ROUTES.md (API catalogue)
```

## Conventions

### TypeScript
- `strict: true` in all tsconfig.json
- `camelCase` for variables, functions, methods
- `PascalCase` for classes, interfaces, types, enums
- `SCREAMING_SNAKE_CASE` for constants
- `snake_case` for DB columns and Kafka topic segments

### API Design
- RESTful: `kebab-case` URLs, e.g. `/api/v1/animal-health/outbreaks`
- Versioned: `/api/v1/...`
- Pagination: `?page=1&limit=20` → response includes `{ data, meta: { total, page, limit } }`
- Filtering: `?status=confirmed&country=KE`
- Sorting: `?sort=createdAt&order=desc`
- All responses: `{ data, meta?, errors? }`
- Error format: `{ statusCode, message, errors: [{ field, message }] }`

### NestJS Service Pattern
```
Controller → Service → Repository (Prisma)
              ↓
         KafkaProducer (events)
              ↓
         DataQualityClient (validation)
```
Every service:
1. Extracts `tenantId` from JWT via `@aris/auth-middleware`
2. Validates input via `class-validator` DTOs
3. Applies `dataClassification` (PUBLIC/PARTNER/RESTRICTED/CONFIDENTIAL) to entities
4. Publishes domain events to Kafka
5. Logs audit trail (actor, timestamp, action, reason, version)

### Multi-Tenant Hierarchy
```
AU-IBAR (level: CONTINENTAL)
  ├── IGAD (level: REC)
  │   ├── Kenya (level: MEMBER_STATE)
  │   ├── Ethiopia (level: MEMBER_STATE)
  │   └── ...
  ├── ECOWAS (level: REC)
  │   ├── Nigeria (level: MEMBER_STATE)
  │   └── ...
  └── ...
```
- `tenantId` is UUID, present in EVERY query (no exceptions)
- Parent tenants can read children's data (REC sees all its MS)
- AU-IBAR sees everything
- `TenantLevel` enum: `CONTINENTAL | REC | MEMBER_STATE`

### RBAC Roles (8 roles)
```typescript
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',           // AU-IBAR system admin
  CONTINENTAL_ADMIN = 'CONTINENTAL_ADMIN', // AU-IBAR program officers
  REC_ADMIN = 'REC_ADMIN',               // REC coordinators
  NATIONAL_ADMIN = 'NATIONAL_ADMIN',     // National administrators (CVO office)
  DATA_STEWARD = 'DATA_STEWARD',         // National/REC data quality officers
  WAHIS_FOCAL_POINT = 'WAHIS_FOCAL_POINT', // Authorized WOAH reporters
  ANALYST = 'ANALYST',                    // Read-only analysts
  FIELD_AGENT = 'FIELD_AGENT',           // Mobile data collectors
}
```

### Data Classification (Annex B §B6)
```typescript
enum DataClassification {
  PUBLIC = 'PUBLIC',             // Open data, aggregated stats
  PARTNER = 'PARTNER',          // Shared with authorized orgs (WOAH, FAO)
  RESTRICTED = 'RESTRICTED',    // Individual outbreak data, unconfirmed
  CONFIDENTIAL = 'CONFIDENTIAL' // Credentials, security, national security
}
```
Classification is **inherited** by derived products.

### Kafka Topics Convention
```
{scope}.{domain}.{entity}.{action}.v{version}

Scopes:   ms (member state) | rec (regional) | au (continental) | sys (system)
Domains:  health | livestock | fisheries | wildlife | apiculture | trade |
          governance | climate | collecte | workflow | quality | interop |
          master | credential | message | realtime
Actions:  created | updated | deleted | validated | rejected | submitted |
          approved | exported | synced | failed
```
Examples:
- `ms.health.outbreak.created.v1`
- `ms.collecte.form.submitted.v1`
- `rec.health.outbreak.alert.v1`
- `au.quality.record.rejected.v1`
- `sys.master.species.updated.v1`
- `au.interop.wahis.exported.v1`

### Workflow — 4-Level Validation (Annex B §B4.1)
```
Level 1: National Data Steward   → Technical validation (quality gates)
Level 2: Data Owner / CVO        → Official national approval (WAHIS-ready)
Level 3: REC Data Steward        → Regional harmonization, cross-border consistency
Level 4: AU-IBAR                 → Continental analytics, publication (with disclaimers)
```
Two parallel publication tracks:
- **Official track**: After Level 2 → WAHIS Focal Point uses WAHIS-ready export
- **Analytical track**: After Level 4 → AU-IBAR publishes dashboards/briefs

### Data Quality Gates (mandatory — Annex B §B4.2)
Every record must pass before publication:
1. **Completeness** — Key fields filled (domain-specific)
2. **Temporal consistency** — Confirmation ≥ suspicion; closure after confirmation
3. **Geographic consistency** — Admin codes valid; coordinates within boundaries
4. **Codes & vocabularies** — Species/diseases/zones in Master Data referentials
5. **Units** — Valid and consistent (SI + sectoral)
6. **Deduplication** — Deterministic + probabilistic on events, samples, holdings
7. **Auditability** — Source system + responsible unit + validation status present
8. **Confidence score** — Auto-calculated (rumor/verified/confirmed) for event-based

### Audit Trail (every mutation)
```typescript
interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';
  actor: { userId: string; role: UserRole; tenantId: string };
  timestamp: Date;
  reason?: string;
  previousVersion?: object;
  newVersion?: object;
  dataClassification: DataClassification;
}
```

### Interoperability Packages (Annex A priority deliverables)
| Package | Content | Format | Frequency |
|---------|---------|--------|-----------|
| WAHIS-ready | Events + 6-monthly + annual + SV capacities | JSON/XML WOAH | Near-real-time + periodic |
| EMPRES-ready | Signals + confidence + context + geo | JSON | Near-real-time |
| FAOSTAT-anchored | Denominators versioned (FAOSTAT vs national census) | CSV/JSON | Annual + updates |
| FishStatJ-aligned | Captures + aquaculture (FAO species/areas) | CSV/JSON | Annual |
| CITES/WDPA/GBIF | Wildlife/conservation reference layers | GeoJSON/API | Quarterly |

### Master Data Referentials (non-negotiable)
| Referential | Content | Source of Authority |
|-------------|---------|---------------------|
| Geography | Countries (ISO 3166), admin 1-3, WGS84, special zones | GADM + national |
| Taxonomy | Domestic + wildlife + aquatic species, production categories | WOAH + FAO |
| Diseases | WOAH list + emerging, WAHIS-aligned codes | WOAH |
| Units | SI + sectoral (heads, doses, tonnes, licenses) | Standard |
| Temporality | Epidemiological calendars, periods | Standard |
| Identifiers | Labs, markets, border points, protected areas | ARIS registry |
| Denominators | FAOSTAT vs national census, documented assumptions | FAOSTAT + census |

## Imports
```typescript
// Shared packages (ALWAYS use these, never duplicate)
import { ... } from '@aris/shared-types';
import { KafkaProducerService, KafkaConsumerService } from '@aris/kafka-client';
import { AuthGuard, RolesGuard, TenantGuard, CurrentUser } from '@aris/auth-middleware';
import { CacheModule, CacheService } from '@aris/cache';
import { I18nModule, I18nService } from '@aris/i18n';
import { QualityGate, QualityRule } from '@aris/quality-rules';
```

## Infrastructure — PgBouncer
- All services connect to PostgreSQL **via PgBouncer** (port 6432), not directly
- `DATABASE_URL` uses `?pgbouncer=true` for Prisma compatibility
- `DIRECT_DATABASE_URL` points to PostgreSQL directly (port 5432) for migrations only
- Config: `infrastructure/pgbouncer/pgbouncer.ini` (transaction pooling, 500 max clients)
- See `docs/architecture/PGBOUNCER.md`

## Cache — `@aris/cache`
- Centralized Redis cache package with domain-aware keys
- Key pattern: `{prefix}{domain}:{entity}:{id}` (e.g., `aris:master-data:species:uuid`)
- TTL strategy: master data 1h, query results 5min, dashboards 2min
- Kafka-driven invalidation via `CacheInvalidationService`
- Distributed locks: `acquireLock()` / `releaseLock()` for concurrent operations
- `MockCacheService` for unit tests
- See `docs/architecture/CACHE-STRATEGY.md`

## Credential Service Routes
```
POST /api/v1/credential/auth/login       # Login (rate limited: 10/min)
POST /api/v1/credential/auth/register    # Register (admin roles only)
POST /api/v1/credential/auth/refresh     # Refresh token
POST /api/v1/credential/auth/logout      # Logout (invalidate token)
GET  /api/v1/credential/users            # List users
GET  /api/v1/credential/users/me         # Current user profile
PUT  /api/v1/credential/users/me/locale  # Update locale preference
PATCH /api/v1/credential/users/:id       # Update user (admin)
POST /api/v1/auth/mfa/setup              # MFA TOTP setup
POST /api/v1/auth/mfa/verify             # MFA verify code
POST /api/v1/auth/mfa/disable            # MFA disable
GET  /api/v1/i18n/enums                  # Translated enums
GET  /api/v1/i18n/locales                # Supported locales (EN, FR, PT, AR)
```

## Landing Page (Public Routes)
```
/                    → Continental page (8 REC cards, stats, login panel)
/rec/[code]          → REC page (member countries, regional stats)
/country/[code]      → Country page (national KPIs, sectors)
```
Data sources:
- `apps/web/src/data/recs-config.ts` — 8 RECs with colors, countries, tenant IDs
- `apps/web/src/data/countries-config.ts` — 55 AU Member States with flags, languages

## NestJS Module Naming Convention
To avoid DI conflicts with `@Global()` modules from shared packages:
- `@aris/auth-middleware` exports `AuthModule` (global) — validates JWTs
- `services/credential` uses `CredentialAuthModule` (NOT `AuthModule`) — handles login/register
- Convention: prefix service-specific modules with the service name

## Testing Strategy
- **Unit tests**: `*.spec.ts` — Mock dependencies, test business logic
- **Integration tests**: `*.integration.spec.ts` — Testcontainers (PG + Kafka + Redis)
- **E2E tests**: `*.e2e.spec.ts` — Full HTTP requests through running service
- **Quality gate tests**: Verify data quality rules produce correct accept/reject
- Every PR must include tests. Coverage target: >80% on services.

## 6 Claude Code Instances
| ID | Name | Scope |
|----|------|-------|
| CC-1 | Platform Core | tenant, credential, message, drive, realtime + ALL packages/ |
| CC-2 | Data Hub | master-data, data-quality, data-contract, interop-hub |
| CC-3 | Collecte & Workflow | form-builder, collecte, workflow |
| CC-4 | Domain Services | animal-health, livestock-prod, fisheries, wildlife, apiculture, trade-sps, governance, climate-env + analytics, geo-services, knowledge-hub |
| CC-5 | Frontend Web | apps/web, apps/admin, packages/ui-components |
| CC-6 | Mobile Kotlin | apps/mobile (Kotlin, Jetpack Compose, Room, offline-first) |

### File Ownership Rule
Each file has ONE owner (one CC instance that modifies it). Other instances read only.
- `packages/*` → CC-1 exclusively
- `services/{service}/` → assigned CC instance
- `apps/web/`, `apps/admin/` → CC-5
- `apps/mobile/` → CC-6
- Conflicts resolved by YOU (human), never by Claude Code.
