<p align="center">
  <img src="apps/web/public/au-logo.png" alt="AU-IBAR Logo" width="120" />
</p>

<h1 align="center">ARIS 3.0 — Animal Resources Information System</h1>

<p align="center">
  <strong>AU-IBAR Continental Digital Infrastructure</strong><br/>
  <em>Federated System-of-Systems for 55 Member States &middot; 8 RECs &middot; 9 Business Domains</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0--rc1-blue" alt="Version" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-10-red" alt="NestJS" />
  <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748" alt="Prisma" />
  <img src="https://img.shields.io/badge/Kafka-KRaft-orange" alt="Kafka" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/license-AU--IBAR-lightgrey" alt="License" />
</p>

---

## Overview

ARIS (Animal Resources Information System) is the **digital backbone** of the African Union's Inter-African Bureau for Animal Resources (AU-IBAR). It provides a continental platform for collecting, validating, analyzing, and reporting data on animal resources across all 55 AU Member States and 8 Regional Economic Communities (RECs).

**Aligned with:** AU Agenda 2063, LiDeSA, PFRS, AU Digital Transformation Strategy 2020-2030.

### 9 Business Domains

| # | Domain | Scope |
|---|--------|-------|
| 1 | **Governance & Capacities** | Legal frameworks, veterinary services, PVS metrics |
| 2 | **Animal Health & One Health** | Surveillance, outbreaks, lab, vaccination, AMR |
| 3 | **Production & Pastoralism** | Census, production systems, transhumance corridors |
| 4 | **Trade, Markets & SPS** | Trade flows, SPS certification, market intelligence (AfCFTA) |
| 5 | **Fisheries & Aquaculture** | Captures, fleet, licenses, aquaculture, aquatic health |
| 6 | **Wildlife & Biodiversity** | Inventories, protected areas, CITES, human-wildlife conflict |
| 7 | **Apiculture & Pollination** | Apiaries, honey production, colony health |
| 8 | **Climate & Environment** | Water stress, rangelands, GHG, vulnerability hotspots |
| 9 | **Knowledge Management** | Portal, e-repository, e-learning, briefs, MEL |

---

## Architecture

```
                          +-----------------------+
                          |   Clients (Web/Mobile) |
                          +-----------+-----------+
                                      |
                          +-----------v-----------+
                          |  Traefik v3 (Gateway)  |
                          |  :4000 HTTP / :4443 TLS|
                          +-----------+-----------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
   +-----v------+             +------v------+              +------v------+
   | Platform    |             | Data Hub    |              | Domain      |
   | Services    |             | Services    |              | Services    |
   | :3001-3008  |             | :3003-3032  |              | :3020-3033  |
   +-----+------+             +------+------+              +------+------+
         |                           |                            |
         +----------------------------+----------------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
   +-----v------+             +------v------+              +------v------+
   | PostgreSQL  |             |  Apache     |              | Redis 7     |
   | 16 + PostGIS|             |  Kafka      |              | Cache/Lock  |
   | via PgBouncer|            |  3 Brokers  |              |             |
   | :6432/:5432 |             |  KRaft Mode |              | :6379       |
   +-------------+             +-------------+              +-------------+
         |                            |
   +-----v------+             +------v------+
   | Elasticsearch|            | MinIO       |
   | 8 (Search)  |            | S3 Storage  |
   | :9200       |            | :9000/:9001 |
   +-------------+            +-------------+
```

> For detailed architecture diagrams, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [docs/architecture/](./docs/architecture/).

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) + React + Tailwind CSS + Shadcn/UI | 14 / 18 |
| **Backend** | NestJS + TypeScript (strict mode) | 10 / 5 |
| **Mobile** | Kotlin + Jetpack Compose + Room (offline-first) | Android |
| **ORM** | Prisma (multi-schema, type-safe) | 6.2 |
| **Database** | PostgreSQL + PostGIS | 16 / 3.4 |
| **Connection Pool** | PgBouncer (transaction pooling) | Latest |
| **Message Broker** | Apache Kafka (KRaft mode, 3 brokers) + Schema Registry | 7.6 |
| **Cache** | Redis (sessions, CQRS, locks, rate limiting) | 7 |
| **Search** | Elasticsearch | 8.13 |
| **Object Storage** | MinIO (S3-compatible) | Latest |
| **API Gateway** | Traefik | v3.0 |
| **Monitoring** | Prometheus + Grafana | Latest |
| **Email (dev)** | Mailpit | v1.18 |
| **Auth** | Custom JWT RS256 + bcrypt + MFA TOTP | - |
| **i18n** | EN, FR, PT, AR (RTL support) | 4 languages |
| **Monorepo** | Turborepo + pnpm workspaces | 2.0 / 9.1 |
| **CI/CD** | GitHub Actions + ArgoCD | - |
| **Tests** | Vitest + Testcontainers | - |

---

## Monorepo Structure

```
aris/
├── README.md                        # This file
├── ARCHITECTURE.md                  # Architecture synthesis
├── CHANGELOG.md                     # Version history
├── CLAUDE.md                        # AI development context
├── package.json                     # pnpm workspace root
├── turbo.json                       # Turborepo config
├── docker-compose.yml               # Infrastructure (Kafka, PG, Redis, etc.)
├── .env.example                     # Environment template
│
├── packages/                        # Shared libraries
│   ├── shared-types/                # TS types, DTOs, Kafka contracts, enums
│   ├── kafka-client/                # Generic Kafka producer/consumer + DLQ
│   ├── auth-middleware/             # JWT RS256 validation + RBAC + tenant extraction
│   ├── db-schemas/                  # Prisma schemas + migrations
│   ├── cache/                       # Redis cache service (domain-aware keys, TTL, locks)
│   ├── i18n/                        # Internationalization (EN, FR, PT, AR)
│   ├── ui-components/               # Design System React (Shadcn + Tailwind)
│   ├── quality-rules/               # Shared data quality gate definitions
│   ├── service-clients/             # Inter-service HTTP clients (retry, circuit breaker)
│   ├── observability/               # Metrics, logging, tracing helpers
│   └── test-utils/                  # Factories, Testcontainers helpers
│
├── services/                        # 22 NestJS microservices
├── apps/                            # Frontend applications
│   ├── web/                         # Next.js 14 main application
│   ├── admin/                       # Admin panel
│   └── mobile/                      # Kotlin Android app
│
├── infrastructure/                  # PgBouncer, configs
│   └── pgbouncer/                   # Connection pooling config
├── infra/                           # Prometheus, Grafana, SQL init
└── docs/                            # Architecture, ADRs, runbooks
    ├── architecture/                # System architecture docs
    └── api/                         # API routes catalogue
```

---

## 22 Microservices

### Platform Services

| Port | Service | Description |
|------|---------|-------------|
| 3001 | **tenant** | Multi-tenant hierarchy (AU &rarr; REC &rarr; Member State) |
| 3002 | **credential** | Authentication (JWT RS256), RBAC, MFA TOTP, rate limiting |
| 3006 | **message** | Notifications: SMS, email, push, in-app |
| 3007 | **drive** | Document storage via MinIO (S3-compatible) |
| 3008 | **realtime** | WebSocket sync for live updates |

### Data Hub Services

| Port | Service | Description |
|------|---------|-------------|
| 3003 | **master-data** | Dictionary: geography, species, diseases, units, identifiers |
| 3004 | **data-quality** | 8 quality gates, confidence scoring, correction loop |
| 3005 | **data-contract** | Contract registry: schema enforcement, frequency, SLA |
| 3032 | **interop-hub** | WAHIS / EMPRES / FAOSTAT / FishStatJ / CITES connectors |

### Collecte & Workflow Services

| Port | Service | Description |
|------|---------|-------------|
| 3010 | **form-builder** | No-code form builder (JSON Schema) |
| 3011 | **collecte** | Campaign orchestration, offline sync |
| 3012 | **workflow** | 4-level validation engine |

### Domain Services

| Port | Service | Description |
|------|---------|-------------|
| 3020 | **animal-health** | Outbreaks, surveillance, lab results, vaccination, AMR |
| 3021 | **livestock-prod** | Census, production systems, slaughter, transhumance |
| 3022 | **fisheries** | Captures, fleet, licenses, aquaculture |
| 3023 | **wildlife** | Inventories, protected areas, CITES permits |
| 3024 | **apiculture** | Apiaries, honey production, colony health |
| 3025 | **trade-sps** | Trade flows, SPS certification, market intelligence |
| 3026 | **governance** | Legal frameworks, veterinary capacities, PVS metrics |
| 3027 | **climate-env** | Water stress, rangelands, GHG, vulnerability hotspots |

### Data & Integration Services

| Port | Service | Description |
|------|---------|-------------|
| 3030 | **analytics** | Kafka Streams, KPIs, denominators, CSV export |
| 3031 | **geo-services** | PostGIS, pg_tileserv, risk layers, spatial queries |
| 3033 | **knowledge-hub** | Portal, e-repository, e-learning, FAQs |

---

## Shared Packages

| Package | Import | Description |
|---------|--------|-------------|
| **shared-types** | `@aris/shared-types` | TypeScript types, DTOs, enums, Kafka contracts |
| **kafka-client** | `@aris/kafka-client` | Generic Kafka producer/consumer with DLQ support |
| **auth-middleware** | `@aris/auth-middleware` | JWT RS256 validation, RBAC guards, tenant extraction |
| **db-schemas** | `@aris/db-schemas` | Prisma schemas and migrations (one per service) |
| **cache** | `@aris/cache` | Redis cache service: domain-aware keys, TTL, Kafka invalidation, distributed locks |
| **i18n** | `@aris/i18n` | Internationalization (EN, FR, PT, AR with RTL) |
| **ui-components** | `@aris/ui-components` | React Design System (Shadcn/UI + Tailwind CSS) |
| **quality-rules** | `@aris/quality-rules` | Data quality gate definitions |
| **service-clients** | `@aris/service-clients` | Inter-service HTTP clients (retry, circuit breaker) |
| **observability** | `@aris/observability` | Prometheus metrics, structured logging |
| **test-utils** | `@aris/test-utils` | Test factories, Testcontainers helpers |

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | &ge;22.0.0 | JavaScript runtime |
| pnpm | &ge;9.0.0 | Package manager |
| Docker | &ge;24 | Container runtime |
| Docker Compose | &ge;v2.20 | Multi-container orchestration |
| OpenSSL | Any modern | JWT key generation |

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/AU-IBAR/aris.git
cd aris

# 2. Configure environment
cp .env.example .env

# 3. Start infrastructure (Kafka, PostgreSQL, Redis, etc.)
docker compose up -d

# 4. Install dependencies
pnpm install

# 5. Generate JWT key pair
pnpm generate:keys

# 6. Run database migrations
pnpm db:migrate

# 7. Seed reference data (55 countries, species, diseases, etc.)
pnpm db:seed

# 8. Start all services in development mode
pnpm dev
```

### Verify Installation

After startup, these interfaces should be accessible:

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Web App** | http://localhost:3100 | Main ARIS web application |
| **Admin Panel** | http://localhost:3100/admin | Administration interface |
| **Credential API** | http://localhost:3002 | Authentication service |
| **Master Data API** | http://localhost:3003 | Reference data service |
| **Traefik Dashboard** | http://localhost:8090 | API gateway routing |
| **Kafka UI** | http://localhost:8080 | Kafka monitoring |
| **Schema Registry** | http://localhost:8081 | Schema governance |
| **Grafana** | http://localhost:3200 | Monitoring dashboards |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Mailpit** | http://localhost:8025 | Email testing (dev) |
| **MinIO Console** | http://localhost:9001 | Object storage |
| **Elasticsearch** | http://localhost:9200 | Search engine |

### Default Credentials (Development)

| Service | User | Password |
|---------|------|----------|
| ARIS Super Admin | `admin@au-aris.org` | `Aris2024!` |
| PostgreSQL | `aris` | `aris_dev_2024` |
| MinIO | `aris_minio` | `aris_minio_2024` |
| Grafana | `admin` | `aris_grafana_2024` |

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services with hot-reload |
| `pnpm build` | Build all packages and services |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:integration` | Run integration tests (Testcontainers) |
| `pnpm lint` | Run ESLint across all workspaces |
| `pnpm format` | Format code with Prettier |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed reference data |
| `pnpm docker:up` | Start infrastructure containers |
| `pnpm docker:down` | Stop infrastructure containers |
| `pnpm docker:reset` | Reset all data and restart containers |
| `pnpm kafka:topics` | Re-create Kafka topics |
| `pnpm generate:keys` | Generate JWT RS256 key pair |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architecture synthesis and overview |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [CLAUDE.md](./CLAUDE.md) | AI development context and conventions |
| [docs/architecture/OVERVIEW.md](./docs/architecture/OVERVIEW.md) | Detailed system architecture |
| [docs/architecture/DEPLOYMENT.md](./docs/architecture/DEPLOYMENT.md) | Deployment guide and infrastructure |
| [docs/architecture/SECURITY.md](./docs/architecture/SECURITY.md) | Security architecture |
| [docs/architecture/CACHE-STRATEGY.md](./docs/architecture/CACHE-STRATEGY.md) | Redis cache strategy (@aris/cache) |
| [docs/architecture/PGBOUNCER.md](./docs/architecture/PGBOUNCER.md) | PgBouncer connection pooling |
| [docs/api/ROUTES.md](./docs/api/ROUTES.md) | API routes catalogue |

---

## License

Copyright &copy; 2024-2026 African Union &mdash; Inter-African Bureau for Animal Resources (AU-IBAR).

All rights reserved. This software is proprietary to AU-IBAR and is not licensed for redistribution without explicit authorization.
