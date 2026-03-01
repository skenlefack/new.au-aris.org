# ARIS 3.0 — System Architecture Overview

> Animal Resources Information System
> AU-IBAR Continental Digital Infrastructure

## 1. Vision

ARIS 3.0 is the **digital backbone** of the African Union's Inter-African Bureau for Animal Resources (AU-IBAR). It is a federated System-of-Systems covering all animal resources across **55 Member States** and **8 Regional Economic Communities (RECs)**.

**Aligned with:** AU Agenda 2063, LiDeSA, PFRS, AU Digital Transformation Strategy 2020-2030.

## 2. Architecture Style

ARIS follows a **microservices architecture** with event-driven communication via Apache Kafka. The system employs **CQRS** (Command Query Responsibility Segregation) with Redis read models for high-performance dashboards, and maintains a full **audit trail** of every mutation.

```mermaid
graph TB
    subgraph "Frontend Layer"
        WEB[Next.js 14 Web App]
        ADMIN[Admin Panel]
        MOBILE[Kotlin Android App<br/>Offline-First]
        LANDING[Public Landing Pages<br/>Continental / REC / Country]
    end

    subgraph "API Gateway Layer"
        TRAEFIK[Traefik v3<br/>:4000 HTTP / :4443 HTTPS]
        AUTH[Auth Middleware<br/>JWT RS256 + RBAC]
    end

    subgraph "Platform Services"
        TENANT[Tenant :3001]
        CRED[Credential :3002]
        MSG[Message :3006]
        DRIVE[Drive :3007]
        RT[Realtime :3008]
    end

    subgraph "Data Hub Services"
        MD[Master Data :3003]
        DQ[Data Quality :3004]
        DC[Data Contract :3005]
        INTEROP[Interop Hub :3032]
    end

    subgraph "Collecte & Workflow"
        FB[Form Builder :3010]
        COL[Collecte :3011]
        WF[Workflow :3012]
    end

    subgraph "Domain Services"
        AH[Animal Health :3020]
        LP[Livestock Prod :3021]
        FISH[Fisheries :3022]
        WILD[Wildlife :3023]
        API_BEE[Apiculture :3024]
        TRADE[Trade & SPS :3025]
        GOV[Governance :3026]
        CLIM[Climate & Env :3027]
    end

    subgraph "Data & Integration"
        ANALYTICS[Analytics :3030]
        GEO[Geo Services :3031]
        KH[Knowledge Hub :3033]
    end

    subgraph "Infrastructure"
        KAFKA[Apache Kafka 7.6<br/>KRaft Mode, 3 Brokers]
        PGBOUNCER[PgBouncer :6432<br/>Transaction Pooling]
        PG[(PostgreSQL 16<br/>+ PostGIS 3.4)]
        REDIS[(Redis 7<br/>+ @aris/cache)]
        ES[(Elasticsearch 8)]
        MINIO[(MinIO<br/>S3-Compatible)]
        PROM[Prometheus + Grafana]
    end

    WEB & ADMIN & MOBILE & LANDING --> TRAEFIK
    TRAEFIK --> AUTH
    AUTH --> TENANT & CRED & MSG & DRIVE & RT
    AUTH --> MD & DQ & DC & INTEROP
    AUTH --> FB & COL & WF
    AUTH --> AH & LP & FISH & WILD & API_BEE & TRADE & GOV & CLIM
    AUTH --> ANALYTICS & GEO & KH

    TENANT & CRED & MD & DQ & DC & COL & WF & AH & LP --> KAFKA
    KAFKA --> ANALYTICS & INTEROP & RT & WF
    TENANT & CRED & MD & DQ & DC & COL & WF & AH & LP & FISH --> PGBOUNCER
    PGBOUNCER --> PG
    ANALYTICS & CRED --> REDIS
    PROM -.->|scrape| TENANT & CRED & MD
    KH & MD --> ES
    DRIVE --> MINIO
```

## 3. Service Inventory (22 Microservices)

### Platform Services (CC-1)

| Service | Port | Purpose |
|---------|------|---------|
| **tenant** | 3001 | Multi-tenant hierarchy (AU → REC → Member State) |
| **credential** | 3002 | Auth JWT RS256, RBAC, MFA, rate limiting |
| **message** | 3006 | Notifications (SMS, email, push, in-app) |
| **drive** | 3007 | Document storage via MinIO (S3-compatible) |
| **realtime** | 3008 | WebSocket sync for live updates |

### Data Hub Services (CC-2)

| Service | Port | Purpose |
|---------|------|---------|
| **master-data** | 3003 | Dictionary: geography, species, diseases, units, identifiers |
| **data-quality** | 3004 | 8 quality gates, confidence scoring, correction loop |
| **data-contract** | 3005 | Contract registry, schema enforcement, SLA tracking |
| **interop-hub** | 3032 | WAHIS/EMPRES/FAOSTAT/FishStatJ/CITES connectors |

### Collecte & Workflow Services (CC-3)

| Service | Port | Purpose |
|---------|------|---------|
| **form-builder** | 3010 | No-code form builder (JSON Schema) |
| **collecte** | 3011 | Campaign orchestration, offline sync |
| **workflow** | 3012 | 4-level validation engine (Annex B &sect;B4.1) |

### Domain Services (CC-4)

| Service | Port | Purpose |
|---------|------|---------|
| **animal-health** | 3020 | Outbreaks, surveillance, lab results, vaccination, AMR |
| **livestock-prod** | 3021 | Census, production systems, slaughter, transhumance |
| **fisheries** | 3022 | Captures, fleet, licenses, aquaculture, aquatic health |
| **wildlife** | 3023 | Inventories, protected areas, CITES, human-wildlife conflict |
| **apiculture** | 3024 | Apiaries, honey production, colony health |
| **trade-sps** | 3025 | Trade flows, SPS certification, market intelligence |
| **governance** | 3026 | Legal frameworks, veterinary capacities, PVS metrics |
| **climate-env** | 3027 | Water stress, rangelands, GHG, vulnerability hotspots |

### Data & Integration Services (CC-4)

| Service | Port | Purpose |
|---------|------|---------|
| **analytics** | 3030 | Kafka Streams, KPIs, denominators, CSV export |
| **geo-services** | 3031 | PostGIS, pg_tileserv, risk layers, spatial queries |
| **knowledge-hub** | 3033 | Portal, e-repository, e-learning, FAQs |

## 4. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Backend | NestJS + TypeScript (strict) | 10 / 5 |
| Frontend | Next.js (App Router) + React + Shadcn/UI + Tailwind CSS | 14 / 18 |
| Mobile | Kotlin + Jetpack Compose + Room (offline-first) | Android |
| ORM | Prisma (multi-schema, type-safe) | 6.2 |
| Message Broker | Apache Kafka (KRaft, no ZooKeeper) + Schema Registry | 7.6 |
| Database | PostgreSQL + PostGIS | 16 / 3.4 |
| Connection Pool | PgBouncer (transaction pooling) | Latest |
| Cache | Redis + `@aris/cache` (domain-aware, Kafka invalidation) | 7 |
| Search | Elasticsearch | 8.13 |
| Object Storage | MinIO (S3-compatible) | Latest |
| API Gateway | Traefik | v3.0 |
| Auth | Custom JWT RS256 + bcrypt + MFA TOTP | - |
| Monitoring | Prometheus + Grafana | Latest |
| i18n | EN, FR, PT, AR (RTL support) | 4 languages |
| Infra | Docker + Kubernetes + Terraform | - |
| CI/CD | GitHub Actions + ArgoCD | - |
| Tests | Vitest + Testcontainers | Latest |
| Monorepo | Turborepo + pnpm workspaces | 2.0 / 9.1 |

## 5. Architecture Principles

1. **Federated Subsidiarity** — Data produced and validated at country level. ARIS consolidates at REC and continental levels.
2. **Report Once, Use Many** — Single entry at country level feeds WAHIS, EMPRES, FAOSTAT, dashboards, and CAADP.
3. **Interoperability by Design** — Master data referentials, data contracts, and audit trails are first-class citizens.
4. **Official vs Analytical Distinction** — WAHIS notifications represent national sovereignty. Dashboards carry provenance and disclaimers.
5. **Production-Grade from Day 1** — HA/DR, RBAC, MFA, audit trail, backups, firewalls, incident response.

## 6. Communication Patterns

### Synchronous (HTTP REST)

- Client-to-service via REST APIs (`/api/v1/...`)
- Inter-service calls via `@aris/service-clients` (retry, circuit breaker, timeout)
- Tenant header forwarding (`x-tenant-id`) on every request

### Asynchronous (Kafka Events)

- Domain events published after every state mutation
- Topic naming: `{scope}.{domain}.{entity}.{action}.v{version}`
- Consumer groups per service for independent scaling
- Dead Letter Queues (DLQ) for failed message processing

### CQRS Pattern

- **Write side**: NestJS services write to PostgreSQL via Prisma
- **Read side**: Analytics service materializes KPIs into Redis
- **Sync**: Kafka events bridge write and read models

```mermaid
flowchart LR
    subgraph "Write Side"
        CMD[Command] --> SVC[Service]
        SVC --> DB[(PostgreSQL)]
        SVC --> KAFKA[Kafka Event]
    end

    subgraph "Read Side"
        KAFKA --> CONSUMER[Kafka Consumer]
        CONSUMER --> REDIS[(Redis KPI Store)]
        REDIS --> QUERY[Query API]
    end
```

## 7. 9 Business Domains

| # | Domain | Scope |
|---|--------|-------|
| 1 | Governance & Capacities | Legal frameworks, veterinary services, PVS metrics |
| 2 | Animal Health & One Health | Surveillance, outbreaks, lab, vaccination, AMR |
| 3 | Production & Pastoralism | Census, production systems, transhumance corridors |
| 4 | Trade, Markets & SPS | Trade flows, SPS certification, market intelligence (AfCFTA) |
| 5 | Fisheries & Aquaculture | Captures, fleet, licenses, aquaculture, aquatic health |
| 6 | Wildlife & Biodiversity | Inventories, protected areas, CITES, human-wildlife conflict |
| 7 | Apiculture & Pollination | Apiaries, honey production, colony health |
| 8 | Climate & Environment | Water stress, rangelands, GHG, vulnerability hotspots |
| 9 | Knowledge Management | Portal, e-repository, e-learning, briefs, MEL |

## 8. Data Flow — End to End

```mermaid
sequenceDiagram
    participant FA as Field Agent (Mobile)
    participant COL as Collecte Service
    participant DQ as Data Quality
    participant WF as Workflow
    participant AH as Animal Health
    participant INTEROP as Interop Hub
    participant ANALYTICS as Analytics

    FA->>COL: Submit form data (offline sync)
    COL->>DQ: POST /validate (8 quality gates)
    DQ-->>COL: PASSED / FAILED / WARNING

    alt Quality PASSED
        COL->>WF: POST /instances (create workflow)
        Note over WF: Level 1: National Data Steward
        WF->>WF: Approve Level 1 (auto or manual)
        Note over WF: Level 2: CVO / Data Owner
        WF->>AH: PATCH entity {wahisReady: true}
        WF->>INTEROP: Kafka: au.workflow.wahis.ready.v1
        Note over WF: Level 3: REC Data Steward
        WF->>WF: Regional harmonization
        Note over WF: Level 4: AU-IBAR
        WF->>AH: PATCH entity {analyticsReady: true}
        WF->>ANALYTICS: Kafka: au.workflow.analytics.ready.v1
    else Quality FAILED
        COL->>FA: Return with actionable errors
        Note over DQ: SLA timer starts
    end

    INTEROP->>INTEROP: Generate WAHIS-ready package
    ANALYTICS->>ANALYTICS: Materialize KPIs to Redis
```

## 9. Monorepo Structure

```
aris/
├── packages/              # Shared libraries
│   ├── shared-types/      # TS types, DTOs, Kafka contracts, enums
│   ├── kafka-client/      # Generic Kafka producer/consumer + DLQ
│   ├── auth-middleware/    # JWT RS256 validation + RBAC + tenant extraction
│   ├── cache/             # Redis cache: domain-aware keys, TTL, Kafka invalidation, locks
│   ├── i18n/              # Internationalization (EN, FR, PT, AR with RTL)
│   ├── service-clients/   # Inter-service HTTP clients (retry, circuit breaker)
│   ├── db-schemas/        # Prisma schemas + migrations (one per service)
│   ├── ui-components/     # Design System React (Shadcn + Tailwind)
│   ├── observability/     # Prometheus metrics, structured logging
│   ├── quality-rules/     # Shared data quality gate definitions
│   └── test-utils/        # Factories, Testcontainers helpers
│
├── services/              # 22 NestJS microservices
├── apps/                  # Frontend applications (web, admin, mobile)
├── infra/                 # Terraform, K8s, Helm
└── docs/                  # Architecture, ADRs, runbooks
```

## 10. Development Team — 6 Claude Code Instances

| ID | Name | Scope |
|----|------|-------|
| CC-1 | Platform Core | tenant, credential, message, drive, realtime + ALL packages/ |
| CC-2 | Data Hub | master-data, data-quality, data-contract, interop-hub |
| CC-3 | Collecte & Workflow | form-builder, collecte, workflow |
| CC-4 | Domain Services | animal-health, livestock-prod, fisheries, wildlife, apiculture, trade-sps, governance, climate-env + analytics, geo-services, knowledge-hub |
| CC-5 | Frontend Web | apps/web, apps/admin, packages/ui-components |
| CC-6 | Mobile Kotlin | apps/mobile (Kotlin, Jetpack Compose, Room, offline-first) |

**File Ownership Rule**: Each file has ONE owner. Other instances read only. Conflicts resolved by human architect.

## 11. PgBouncer — Connection Pooling

With 22 microservices each opening their own Prisma connection pool, direct connections to PostgreSQL would quickly exhaust the `max_connections` limit. PgBouncer acts as a lightweight connection proxy.

```mermaid
graph LR
    subgraph "22 NestJS Services"
        S1[Tenant :3001]
        S2[Credential :3002]
        S3[Master Data :3003]
        SN[... :30xx]
    end

    subgraph "Connection Pooling"
        PGB[PgBouncer :6432<br/>Transaction Pooling<br/>500 max clients → 20 server conns]
    end

    subgraph "Database"
        PG[(PostgreSQL 16<br/>+ PostGIS 3.4<br/>:5432)]
    end

    S1 & S2 & S3 & SN --> PGB --> PG
```

### Key Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `pool_mode` | `transaction` | Connections returned after each transaction |
| `max_client_conn` | 500 | Total client connections accepted |
| `default_pool_size` | 20 | Actual PostgreSQL connections |
| `ignore_startup_parameters` | `extra_float_digits,search_path` | Prisma compatibility |

### Prisma Dual URLs

```env
DATABASE_URL=postgresql://...@localhost:6432/aris?pgbouncer=true    # Runtime (PgBouncer)
DIRECT_DATABASE_URL=postgresql://...@localhost:5432/aris             # Migrations (direct)
```

> See [PGBOUNCER.md](./PGBOUNCER.md) for full documentation.

## 12. Redis Cache — `@aris/cache`

The `@aris/cache` package provides a centralized, domain-aware caching layer for all services.

### Architecture (Cache-Aside Pattern)

```mermaid
flowchart LR
    SVC[Service] -->|1. getOrSet| CACHE["@aris/cache"]
    CACHE -->|2. HIT| REDIS[(Redis 7)]
    CACHE -->|3. MISS| PRISMA[Prisma] --> PG[(PostgreSQL)]
    KAFKA[Kafka Event] -->|4. Invalidate| INV[CacheInvalidationService]
    INV --> REDIS
```

### Key Patterns

```
{prefix}{domain}:{entity}:{id}
aris:master-data:species:uuid-123
aris:animal-health:outbreak:uuid-456
aris:analytics:dashboard:continental
```

### TTL Strategy

| Category | TTL | Rationale |
|----------|-----|-----------|
| Master data | 1 hour | Rarely changes, high read frequency |
| Session | 30 min | Aligned with JWT refresh |
| Query results | 5 min | Balance freshness vs DB load |
| Dashboard KPIs | 2 min | Near-real-time analytics |
| Rate limits | 1 min | Short-lived sliding windows |

### Features

- **Cache-aside**: `getOrSet(key, ttl, fetchFn)` for transparent caching
- **Domain-aware keys**: `buildCacheKey(domain, entity, id)` helpers
- **Kafka invalidation**: `CacheInvalidationService` listens for domain events and clears stale keys
- **Distributed locks**: `acquireLock` / `releaseLock` for exclusive operations (imports, reports)
- **Monitoring**: Hit/miss ratio via `getStats()`
- **Testing**: `MockCacheService` for unit tests (in-memory Map)

> See [CACHE-STRATEGY.md](./CACHE-STRATEGY.md) for full documentation.

## 13. Landing Page Architecture

The public-facing landing page provides a 3-level navigation hierarchy matching the AU multi-tenant structure.

### Public Routes (No Authentication Required)

```
/                        → Continental page (8 REC cards, stats, login panel)
/rec/[code]              → REC page (member countries, regional stats)
/country/[code]          → Country page (national KPIs, sector performance)
```

### Protected Routes (Authentication Required)

```
/home                    → Dashboard (after login)
/knowledge/*             → Knowledge hub, e-learning, FAQs
/...                     → All other domain pages
```

### Data Sources

| File | Content | Size |
|------|---------|------|
| `apps/web/src/data/recs-config.ts` | 8 RECs with colors, country codes, tenant IDs | 8 entries |
| `apps/web/src/data/countries-config.ts` | 55 AU Member States with flags, languages, REC memberships | 55 entries |

### Components

```
apps/web/src/components/landing/
├── LandingHeader.tsx     # AU-IBAR header with navigation
├── HeroSection.tsx       # Hero banner with stats
├── ContinentalStats.tsx  # Aggregate continental statistics
├── RecCard.tsx           # Individual REC card component
└── LoginPanel.tsx        # Contextual login form (sidebar)
```
