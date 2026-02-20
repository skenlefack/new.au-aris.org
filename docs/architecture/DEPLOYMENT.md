# ARIS 3.0 -- Deployment Guide

AU-IBAR Animal Resources Information System -- Continental Digital Infrastructure

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Docker Compose Stack](#3-docker-compose-stack)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Database Initialization](#5-database-initialization)
6. [Service Ports](#6-service-ports)
7. [Turborepo Commands](#7-turborepo-commands)
8. [JWT Key Generation](#8-jwt-key-generation)
9. [Scaling Considerations](#9-scaling-considerations)
10. [Production Checklist](#10-production-checklist)

---

## 1. Prerequisites

Before setting up the ARIS development environment, ensure the following tools are installed:

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20 LTS (>=20.0.0) | JavaScript runtime for all backend and frontend services |
| **pnpm** | 9+ (>=9.0.0) | Fast, disk-efficient package manager for the monorepo |
| **Docker** | 24+ | Container runtime for infrastructure services |
| **Docker Compose** | v2.20+ | Multi-container orchestration (bundled with Docker Desktop) |
| **OpenSSL** | Any modern version | JWT RS256 key pair generation |
| **Git** | 2.40+ | Source control |
| **Turborepo** | 2.0+ | Monorepo build orchestration (installed via devDependencies) |

### System Requirements (Development)

- **RAM**: Minimum 16 GB (the Docker Compose stack alone uses ~6-8 GB)
- **Disk**: Minimum 20 GB free for Docker images, volumes, and node_modules
- **CPU**: 4+ cores recommended
- **OS**: Linux, macOS, or Windows 11 with WSL2

### Verifying Prerequisites

```bash
node --version          # v20.x.x
pnpm --version          # 9.x.x
docker --version        # 24.x.x or later
docker compose version  # v2.20.x or later
openssl version         # OpenSSL 3.x.x
git --version           # 2.40.x or later
```

---

## 2. Quick Start

Follow these steps to get the full ARIS development environment running from scratch.

### Step 1: Clone the Repository

```bash
git clone https://github.com/AU-IBAR/aris.git
cd aris
```

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Review and customize `.env` as needed. The defaults are configured for local development.

### Step 3: Start Infrastructure Services

```bash
docker compose up -d
```

This starts all infrastructure containers: Kafka cluster (3 brokers), PostgreSQL + PostGIS, Redis, Elasticsearch, MinIO, Mailpit, Traefik, Schema Registry, Kafka UI, and the topic initializer.

Wait for all containers to become healthy:

```bash
docker compose ps
```

All services should show `healthy` or `running` status. The Kafka topic initializer (`aris-kafka-init`) will exit after creating all topics.

### Step 4: Install Dependencies

```bash
pnpm install
```

This installs all workspace dependencies across packages, services, and apps.

### Step 5: Generate JWT Keys

```bash
pnpm generate:keys
```

This creates `keys/private.pem` and `keys/public.pem` for RS256 JWT authentication.

### Step 6: Run Database Migrations

```bash
pnpm db:migrate
```

This runs Prisma migrations for every service schema against the PostgreSQL database.

### Step 7: Seed the Database (Optional)

```bash
pnpm db:seed
```

Populates the database with reference data (countries, species, diseases, admin units, etc.).

### Step 8: Start Development Servers

```bash
pnpm dev
```

Turborepo starts all services and apps in parallel with hot-reload enabled.

### Verification

After startup, verify that the key interfaces are accessible:

| Interface | URL | Purpose |
|-----------|-----|---------|
| Kafka UI | http://localhost:8080 | Monitor Kafka brokers, topics, consumer groups |
| Schema Registry | http://localhost:8081 | View and manage Avro/JSON schemas |
| Elasticsearch | http://localhost:9200 | Search engine API (verify `cluster_name: aris-search`) |
| MinIO Console | http://localhost:9001 | Object storage management UI |
| Mailpit Web | http://localhost:8025 | View captured development emails |
| Traefik Dashboard | http://localhost:8090 | API gateway routing and health |

---

## 3. Docker Compose Stack

The `docker-compose.yml` defines the complete infrastructure layer. All services run on a shared `aris-network` bridge network.

### 3.1 Kafka KRaft Cluster (3 Brokers)

ARIS uses Apache Kafka in **KRaft mode** (no ZooKeeper dependency). The cluster consists of three combined broker/controller nodes using `confluentinc/cp-kafka:7.6.1`.

| Broker | Container | External Port | Internal Port | Node ID |
|--------|-----------|---------------|---------------|---------|
| kafka-1 | aris-kafka-1 | 9092 | 29092 | 1 |
| kafka-2 | aris-kafka-2 | 9094 | 29092 | 2 |
| kafka-3 | aris-kafka-3 | 9096 | 29092 | 3 |

**Key Configuration:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `CLUSTER_ID` | `MkU3OEVBNTcwNTJENDM2Qk` | KRaft cluster identifier (Base64-encoded UUID) |
| `KAFKA_DEFAULT_REPLICATION_FACTOR` | 3 | Every topic replicated across all brokers |
| `KAFKA_MIN_INSYNC_REPLICAS` | 2 | Minimum replicas that must acknowledge a write |
| `KAFKA_NUM_PARTITIONS` | 6 | Default partitions for auto-created topics |
| `KAFKA_AUTO_CREATE_TOPICS_ENABLE` | false | Topics must be explicitly created |
| `KAFKA_LOG_RETENTION_HOURS` | 168 | 7-day log retention |
| `KAFKA_LOG_RETENTION_BYTES` | 1073741824 | 1 GB per partition retention limit |

Controller quorum: `1@kafka-1:9093,2@kafka-2:9093,3@kafka-3:9093`

Listener layout per broker:
- `PLAINTEXT` (29092) -- inter-broker communication
- `CONTROLLER` (9093) -- KRaft controller traffic
- `EXTERNAL` (9092/9094/9096) -- host-accessible client connections

### 3.2 Kafka UI

- **Image**: `provectuslabs/kafka-ui:v0.7.2`
- **Port**: 8080
- **Purpose**: Web-based monitoring and management of the Kafka cluster
- Connects to all three brokers via internal PLAINTEXT listeners
- Dynamic configuration enabled for runtime changes

### 3.3 Schema Registry

- **Image**: `confluentinc/cp-schema-registry:7.6.1`
- **Port**: 8081
- **Purpose**: Avro/JSON Schema governance for Kafka message contracts
- Schema compatibility level: `BACKWARD` (consumers can read old and new schemas)
- Stores schemas in a Kafka internal topic

### 3.4 PostgreSQL 16 + PostGIS 3.4

- **Image**: `postgis/postgis:16-3.4`
- **Port**: 5432
- **Credentials**: user `aris`, password `aris_dev_2024`, database `aris`
- **Volume**: `postgres-data` persists data across restarts
- **Init script**: `infra/init-databases.sql` runs on first startup, creating 22 schemas + extensions
- **Healthcheck**: `pg_isready -U aris` every 10s, 5 retries

### 3.5 Redis 7

- **Image**: `redis:7-alpine`
- **Port**: 6379
- **Purpose**: Session cache, CQRS read models, pub/sub, distributed locks
- **Configuration**: AOF persistence enabled, 512 MB max memory, `allkeys-lru` eviction policy
- **Volume**: `redis-data` persists data
- **Healthcheck**: `redis-cli ping` every 10s

### 3.6 Elasticsearch 8.13.4

- **Image**: `docker.elastic.co/elasticsearch/elasticsearch:8.13.4`
- **Port**: 9200
- **Cluster name**: `aris-search`
- **Mode**: Single-node discovery (development)
- **Security**: Disabled (`xpack.security.enabled=false` for dev)
- **JVM Heap**: 512 MB min/max
- **Volume**: `es-data` persists indices
- **Healthcheck**: HTTP `/_cluster/health` every 30s

### 3.7 MinIO (S3-Compatible Object Storage)

- **Image**: `minio/minio:RELEASE.2024-04-18T19-09-19Z`
- **Ports**: 9000 (S3 API), 9001 (Web Console)
- **Credentials**: user `aris_minio`, password `aris_minio_2024`
- **Volume**: `minio-data` persists objects
- **Healthcheck**: `mc ready local` every 30s

### 3.8 Mailpit (Email Testing)

- **Image**: `axllent/mailpit:v1.18`
- **Ports**: 1025 (SMTP), 8025 (Web UI)
- **Purpose**: Captures all outgoing emails in development. No emails leave the system.
- Browse captured emails at http://localhost:8025

### 3.9 Traefik (API Gateway)

- **Image**: `traefik:v3.0`
- **Ports**: 4000 (HTTP entrypoint), 4443 (HTTPS future), 8090 (Dashboard)
- **Purpose**: Reverse proxy and API gateway for service routing
- Docker provider enabled (auto-discovers labeled containers)
- JSON access logging enabled
- Dashboard: http://localhost:8090

### 3.10 Topic Initializer

The `kafka-init` container is a one-shot service that waits for the Kafka cluster to be ready and then creates all required topics. It uses `confluentinc/cp-kafka:7.6.1` and exits after completion.

**Topics created (36 total):**

| Category | Topic | Partitions | Replication |
|----------|-------|------------|-------------|
| **System** | `sys.tenant.created.v1` | 3 | 3 |
| | `sys.tenant.updated.v1` | 3 | 3 |
| | `sys.credential.user.created.v1` | 3 | 3 |
| | `sys.credential.user.authenticated.v1` | 6 | 3 |
| | `sys.message.notification.sent.v1` | 6 | 3 |
| | `sys.message.notification.failed.v1` | 3 | 3 |
| | `sys.drive.file.uploaded.v1` | 3 | 3 |
| **Master Data** | `sys.master.geo.updated.v1` | 3 | 3 |
| | `sys.master.species.updated.v1` | 3 | 3 |
| | `sys.master.disease.updated.v1` | 3 | 3 |
| | `sys.master.denominator.updated.v1` | 3 | 3 |
| **Quality** | `au.quality.record.validated.v1` | 6 | 3 |
| | `au.quality.record.rejected.v1` | 6 | 3 |
| | `au.quality.correction.overdue.v1` | 3 | 3 |
| **Collecte** | `ms.collecte.campaign.created.v1` | 3 | 3 |
| | `ms.collecte.form.submitted.v1` | 12 | 3 |
| | `ms.collecte.form.synced.v1` | 6 | 3 |
| **Form Builder** | `ms.formbuilder.template.created.v1` | 3 | 3 |
| | `ms.formbuilder.template.published.v1` | 3 | 3 |
| **Workflow** | `au.workflow.validation.submitted.v1` | 6 | 3 |
| | `au.workflow.validation.approved.v1` | 6 | 3 |
| | `au.workflow.validation.rejected.v1` | 6 | 3 |
| | `au.workflow.validation.escalated.v1` | 3 | 3 |
| | `au.workflow.wahis.ready.v1` | 3 | 3 |
| | `au.workflow.analytics.ready.v1` | 3 | 3 |
| **Health Domain** | `ms.health.event.created.v1` | 6 | 3 |
| | `ms.health.event.updated.v1` | 6 | 3 |
| | `ms.health.event.confirmed.v1` | 6 | 3 |
| | `ms.health.lab.result.created.v1` | 6 | 3 |
| | `ms.health.vaccination.completed.v1` | 6 | 3 |
| | `ms.health.surveillance.reported.v1` | 6 | 3 |
| | `rec.health.outbreak.alert.v1` | 3 | 3 |
| **Interop** | `au.interop.wahis.exported.v1` | 3 | 3 |
| | `au.interop.empres.fed.v1` | 3 | 3 |
| | `au.interop.faostat.synced.v1` | 3 | 3 |
| **Dead Letter Queues** | `dlq.all.v1` | 3 | 3 |
| | `dlq.health.v1` | 3 | 3 |
| | `dlq.collecte.v1` | 3 | 3 |

**Topic naming convention**: `{scope}.{domain}.{entity}.{action}.v{version}`

High-throughput topics (form submissions, authentication events, health events, workflow validations) are provisioned with 6 or 12 partitions. Low-throughput reference data topics use 3 partitions.

### Docker Volumes

| Volume | Service | Purpose |
|--------|---------|---------|
| `kafka-1-data` | kafka-1 | Broker 1 log segments |
| `kafka-2-data` | kafka-2 | Broker 2 log segments |
| `kafka-3-data` | kafka-3 | Broker 3 log segments |
| `postgres-data` | postgres | Database files |
| `redis-data` | redis | AOF persistence |
| `es-data` | elasticsearch | Search indices |
| `minio-data` | minio | Object storage |

To reset all data and start fresh:

```bash
pnpm docker:reset
# Equivalent to: docker compose down -v && docker compose up -d
```

---

## 4. Environment Variables Reference

Copy `.env.example` to `.env` before starting development. All variables below show their default development values.

### General

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |
| `LOG_LEVEL` | `debug` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

### PostgreSQL + PostGIS

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_USER` | `aris` | Database user |
| `POSTGRES_PASSWORD` | `aris_dev_2024` | Database password |
| `POSTGRES_DB` | `aris` | Database name |
| `DATABASE_URL` | `postgresql://aris:aris_dev_2024@localhost:5432/aris` | Prisma connection string |

### Kafka

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKERS` | `localhost:9092,localhost:9094,localhost:9096` | Comma-separated broker list |
| `KAFKA_CLIENT_ID` | `aris-dev` | Client identifier for broker connections |
| `SCHEMA_REGISTRY_URL` | `http://localhost:8081` | Confluent Schema Registry endpoint |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |

### Elasticsearch

| Variable | Default | Description |
|----------|---------|-------------|
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch endpoint |

### MinIO (S3-Compatible Storage)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO S3 API host |
| `MINIO_PORT` | `9000` | MinIO S3 API port |
| `MINIO_ROOT_USER` | `aris_minio` | MinIO access key |
| `MINIO_ROOT_PASSWORD` | `aris_minio_2024` | MinIO secret key |
| `MINIO_BUCKET` | `aris-documents` | Default bucket for document storage |

### Email (Mailpit in Development)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `localhost` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port (Mailpit) |
| `SMTP_FROM` | `noreply@aris.africa` | Default sender address |

### JWT Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ALGORITHM` | `RS256` | JWT signing algorithm |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `JWT_PRIVATE_KEY_PATH` | `./keys/private.pem` | Path to RSA private key (signing) |
| `JWT_PUBLIC_KEY_PATH` | `./keys/public.pem` | Path to RSA public key (verification) |

### Service Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `TENANT_PORT` | `3001` | Tenant service |
| `CREDENTIAL_PORT` | `3002` | Credential/auth service |
| `MASTER_DATA_PORT` | `3003` | Master data service |
| `DATA_QUALITY_PORT` | `3004` | Data quality service |
| `DATA_CONTRACT_PORT` | `3005` | Data contract service |
| `MESSAGE_PORT` | `3006` | Notification service |
| `DRIVE_PORT` | `3007` | Document storage service |
| `REALTIME_PORT` | `3008` | WebSocket service |
| `FORM_BUILDER_PORT` | `3010` | Form builder service |
| `COLLECTE_PORT` | `3011` | Collection service |
| `WORKFLOW_PORT` | `3012` | Workflow service |
| `ANIMAL_HEALTH_PORT` | `3020` | Animal health service |
| `LIVESTOCK_PROD_PORT` | `3021` | Livestock production service |
| `FISHERIES_PORT` | `3022` | Fisheries service |
| `WILDLIFE_PORT` | `3023` | Wildlife service |
| `APICULTURE_PORT` | `3024` | Apiculture service |
| `TRADE_SPS_PORT` | `3025` | Trade/SPS service |
| `GOVERNANCE_PORT` | `3026` | Governance service |
| `CLIMATE_ENV_PORT` | `3027` | Climate/environment service |
| `ANALYTICS_PORT` | `3030` | Analytics service |
| `GEO_SERVICES_PORT` | `3031` | Geo services |
| `INTEROP_HUB_PORT` | `3032` | Interoperability hub |
| `KNOWLEDGE_HUB_PORT` | `3033` | Knowledge hub |

---

## 5. Database Initialization

### Init Script (`infra/init-databases.sql`)

On first startup, PostgreSQL executes the initialization script mounted at `/docker-entrypoint-initdb.d/01-init-databases.sql`. This script performs three operations:

#### 5.1 PostgreSQL Extensions

```sql
CREATE EXTENSION IF NOT EXISTS postgis;       -- Spatial data types, functions, indexing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation (uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Trigram-based fuzzy text search
```

#### 5.2 Per-Service Schemas (22 schemas)

Each microservice has its own isolated schema within the single `aris` database. This provides logical separation while allowing cross-service joins when needed.

| Schema | Service | CC Owner |
|--------|---------|----------|
| `tenant` | Tenant service | CC-1 |
| `credential` | Auth/credential service | CC-1 |
| `master_data` | Master data service | CC-2 |
| `data_quality` | Data quality service | CC-2 |
| `data_contract` | Data contract service | CC-2 |
| `message` | Notification service | CC-1 |
| `drive` | Document storage service | CC-1 |
| `form_builder` | Form builder service | CC-3 |
| `collecte` | Collection service | CC-3 |
| `workflow` | Workflow service | CC-3 |
| `animal_health` | Animal health service | CC-4 |
| `livestock_prod` | Livestock production service | CC-4 |
| `fisheries` | Fisheries service | CC-4 |
| `wildlife` | Wildlife service | CC-4 |
| `apiculture` | Apiculture service | CC-4 |
| `trade_sps` | Trade/SPS service | CC-4 |
| `governance` | Governance service | CC-4 |
| `climate_env` | Climate/environment service | CC-4 |
| `analytics` | Analytics service | CC-4 |
| `geo_services` | Geo services | CC-4 |
| `knowledge_hub` | Knowledge hub service | CC-4 |
| `interop_hub` | Interoperability hub | CC-2 |
| `audit` | Shared audit log | Shared |

#### 5.3 Shared Audit Log Table

The `audit.audit_log` table is shared across all services and records every mutation:

```sql
CREATE TABLE audit.audit_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type         VARCHAR(100) NOT NULL,
    entity_id           UUID NOT NULL,
    action              VARCHAR(50) NOT NULL,       -- CREATE, UPDATE, DELETE, VALIDATE, REJECT, EXPORT
    actor_user_id       UUID,
    actor_role          VARCHAR(50),
    actor_tenant_id     UUID,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason              TEXT,
    previous_version    JSONB,
    new_version         JSONB,
    data_classification VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED',
    service_name        VARCHAR(50) NOT NULL,
    ip_address          INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexed on: `(entity_type, entity_id)`, `(actor_user_id)`, `(actor_tenant_id)`, `(timestamp)`.

### Prisma Multi-Schema

ARIS uses Prisma 5 with the `prismaSchemaFolder` preview feature to manage migrations per service schema. Each service has its own Prisma schema file that targets its dedicated PostgreSQL schema:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["animal_health"]
}
```

Run all migrations across the monorepo:

```bash
pnpm db:migrate
```

This command is orchestrated by Turborepo and runs `prisma migrate deploy` for each service that defines a `db:migrate` script.

---

## 6. Service Ports

All 22 backend services and their assigned ports:

| Port | Service | Path | Domain |
|------|---------|------|--------|
| **Platform (CC-1)** | | | |
| 3001 | Tenant | `services/tenant` | Multi-tenant hierarchy (AU, REC, MS) |
| 3002 | Credential | `services/credential` | Auth, JWT RS256, RBAC, MFA |
| 3006 | Message | `services/message` | Notifications (SMS, email, push, in-app) |
| 3007 | Drive | `services/drive` | Document storage (MinIO S3) |
| 3008 | Realtime | `services/realtime` | WebSocket sync |
| **Data Hub (CC-2)** | | | |
| 3003 | Master Data | `services/master-data` | Dictionary: geo, species, diseases, units |
| 3004 | Data Quality | `services/data-quality` | Quality gates, confidence scoring |
| 3005 | Data Contract | `services/data-contract` | Contract registry (schema, frequency, SLA) |
| 3032 | Interop Hub | `services/interop-hub` | WAHIS/EMPRES/FAOSTAT connectors |
| **Collecte & Workflow (CC-3)** | | | |
| 3010 | Form Builder | `services/form-builder` | No-code form builder (JSON Schema) |
| 3011 | Collecte | `services/collecte` | Campaign orchestration, offline sync |
| 3012 | Workflow | `services/workflow` | 4-level validation engine |
| **Domain Services (CC-4)** | | | |
| 3020 | Animal Health | `services/animal-health` | Outbreaks, surveillance, lab, vaccination |
| 3021 | Livestock Prod | `services/livestock-prod` | Census, production, transhumance |
| 3022 | Fisheries | `services/fisheries` | Captures, fleet, aquaculture |
| 3023 | Wildlife | `services/wildlife` | Inventories, protected areas, CITES |
| 3024 | Apiculture | `services/apiculture` | Apiaries, production, colony health |
| 3025 | Trade SPS | `services/trade-sps` | Trade flows, SPS certification, markets |
| 3026 | Governance | `services/governance` | Legal frameworks, capacities, PVS |
| 3027 | Climate Env | `services/climate-env` | Water stress, rangelands, hotspots |
| **Data & Integration (CC-4)** | | | |
| 3030 | Analytics | `services/analytics` | Kafka Streams, KPIs, denominators |
| 3031 | Geo Services | `services/geo-services` | PostGIS, pg_tileserv, risk layers |
| 3033 | Knowledge Hub | `services/knowledge-hub` | Portal, e-repository, e-learning |

**Infrastructure ports (Docker Compose):**

| Port | Service | Purpose |
|------|---------|---------|
| 4000 | Traefik | API gateway HTTP entrypoint |
| 4443 | Traefik | HTTPS entrypoint (future TLS) |
| 5432 | PostgreSQL | Database connections |
| 6379 | Redis | Cache/session connections |
| 8025 | Mailpit | Email testing web UI |
| 8080 | Kafka UI | Kafka monitoring dashboard |
| 8081 | Schema Registry | Schema governance API |
| 8090 | Traefik | Traefik admin dashboard |
| 9000 | MinIO | S3-compatible API |
| 9001 | MinIO | Web management console |
| 9092 | Kafka Broker 1 | Client connections |
| 9094 | Kafka Broker 2 | Client connections |
| 9096 | Kafka Broker 3 | Client connections |
| 9200 | Elasticsearch | Search API |
| 1025 | Mailpit | SMTP server (dev) |

---

## 7. Turborepo Commands

All commands are defined in the root `package.json` and orchestrated by Turborepo across the monorepo.

### Build Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages, services, and apps (respects dependency graph) |
| `pnpm dev` | Start all services in development mode with hot-reload |
| `pnpm clean` | Remove all `dist/`, `node_modules/`, and Turborepo cache |

### Test Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests across all workspaces (Vitest) |
| `pnpm test:integration` | Run integration tests with Testcontainers (PG + Kafka + Redis) |
| `pnpm lint` | Run ESLint across all workspaces |
| `pnpm format` | Run Prettier on `**/*.{ts,tsx,md,json}` |

### Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:migrate` | Run Prisma migrations for all services |
| `pnpm db:seed` | Seed reference data (depends on `db:migrate`) |

### Docker Commands

| Command | Description |
|---------|-------------|
| `pnpm docker:up` | Start all infrastructure containers (`docker compose up -d`) |
| `pnpm docker:down` | Stop all infrastructure containers |
| `pnpm docker:logs` | Tail logs from all containers |
| `pnpm docker:reset` | Destroy volumes and recreate containers (full reset) |

### Other Commands

| Command | Description |
|---------|-------------|
| `pnpm kafka:topics` | Re-run topic initializer (`docker compose up kafka-init`) |
| `pnpm generate:keys` | Generate JWT RS256 key pair in `keys/` directory |

### Turborepo Task Dependencies

```
build       --> depends on ^build (shared packages built first)
dev         --> depends on ^build (persistent, no cache)
test        --> depends on ^build (outputs coverage/**)
test:integration --> depends on ^build (no cache)
lint        --> depends on ^build
db:migrate  --> depends on ^build (no cache)
db:seed     --> depends on db:migrate (no cache)
```

The `^build` dependency ensures that shared packages (`@aris/shared-types`, `@aris/kafka-client`, etc.) are built before any service that depends on them.

---

## 8. JWT Key Generation

ARIS uses RS256 (RSA with SHA-256) for JWT signing and verification. The credential service signs tokens with the private key; all other services verify tokens with the public key.

### Generate Keys (Development)

```bash
pnpm generate:keys
```

This runs the following:

```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### Manual Key Generation

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out keys/private.pem 2048

# Extract the public key
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Verify the key pair
openssl rsa -in keys/private.pem -check
```

### Key Configuration

The `.env` file references the key paths:

```env
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

### Security Notes

- The `keys/` directory is in `.gitignore`. **Never commit private keys to version control.**
- In production, keys should be managed via a secrets manager (HashiCorp Vault, AWS Secrets Manager, K8s Secrets with encryption at rest).
- Consider using 4096-bit keys for production environments.
- Rotate keys periodically; implement key versioning (JWK `kid` claim) for zero-downtime rotation.

---

## 9. Scaling Considerations

### 9.1 Kafka Partitions

- High-throughput topics (`ms.collecte.form.submitted.v1`) are provisioned with 12 partitions to support parallel consumer groups across multiple service replicas.
- Standard domain event topics use 6 partitions, allowing up to 6 concurrent consumers per consumer group.
- Reference data topics use 3 partitions (low-throughput, consistency-oriented).
- When scaling consumers, the number of replicas should not exceed the partition count for a given topic.
- Monitor consumer lag via Kafka UI or Prometheus JMX metrics and increase partitions if lag grows.

### 9.2 PostgreSQL Read Replicas

- Deploy streaming replicas for read-heavy workloads (analytics, dashboards, reporting).
- Use `DATABASE_READ_URL` environment variable to route read queries to replicas.
- Replicas serve the analytics service, geo-services, and knowledge-hub read paths.
- Consider PgBouncer for connection pooling in production (each NestJS service opens its own Prisma connection pool).
- Schema-per-service isolation means replicas carry all schemas; use `pg_hba.conf` to restrict per-service access.

### 9.3 Redis Cluster

- In development, a single Redis instance with 512 MB is sufficient.
- In production, deploy Redis Cluster (minimum 6 nodes: 3 masters + 3 replicas) for high availability.
- Separate cache workloads (sessions, CQRS read models) from pub/sub workloads if throughput demands it.
- Configure `maxmemory-policy` appropriately: `allkeys-lru` for cache, `noeviction` for critical session data.

### 9.4 Kubernetes Horizontal Pod Autoscaler (HPA)

- Each NestJS microservice is deployed as an independent Kubernetes Deployment.
- HPA targets:
  - **CPU-based**: Scale at 70% CPU utilization.
  - **Custom metrics**: Scale on Kafka consumer lag (via Prometheus adapter).
- Minimum replicas:
  - Platform services (tenant, credential): 2 replicas minimum for HA.
  - Domain services: 1 replica minimum, scale to 3+ based on load.
  - Form submission ingestion (collecte): Scale aggressively during campaign periods.
- Use Pod Disruption Budgets (PDB) to ensure availability during rolling updates.

### 9.5 Elasticsearch Scaling

- Move from single-node to a 3-node cluster in production (1 master, 2 data nodes minimum).
- Index lifecycle management (ILM) for time-series data (audit logs, event history).
- Shard sizing: Target 20-40 GB per shard for optimal performance.

### 9.6 MinIO Scaling

- Production deployments should use MinIO in distributed mode (minimum 4 nodes, 1 drive each).
- Enable erasure coding for data durability.
- Configure bucket lifecycle policies for archival of old documents.

---

## 10. Production Checklist

### 10.1 Transport Security (TLS)

- [ ] Enable TLS termination at the Traefik ingress (Let's Encrypt or organizational CA).
- [ ] Configure PostgreSQL with `sslmode=require` and provide server certificates.
- [ ] Enable Redis TLS (`tls-port 6380`, provide cert/key/ca files).
- [ ] Enable Elasticsearch `xpack.security.enabled=true` with TLS for transport and HTTP layers.
- [ ] Configure MinIO with TLS certificates for the S3 API endpoint.
- [ ] All inter-service communication must use HTTPS or mTLS within the Kubernetes cluster.

### 10.2 Kafka Security (SASL_SSL)

- [ ] Replace `PLAINTEXT` listeners with `SASL_SSL` for all client-facing and inter-broker communication.
- [ ] Use SCRAM-SHA-512 or OAUTHBEARER for client authentication.
- [ ] Enable ACLs to restrict topic access per service (principle of least privilege).
- [ ] Configure Schema Registry with HTTPS and authentication.
- [ ] Set `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` (already configured).
- [ ] Monitor with JMX + Prometheus exporter (port 9997 is pre-configured).

### 10.3 Secrets Management

- [ ] Never store secrets in `.env` files, environment variables, or Docker Compose files in production.
- [ ] Use Kubernetes Secrets (encrypted at rest with KMS) or HashiCorp Vault.
- [ ] Rotate database passwords, JWT keys, MinIO credentials, and Kafka SASL credentials periodically.
- [ ] Store JWT private keys in a hardware security module (HSM) or Vault transit engine for critical deployments.
- [ ] Audit secret access and rotation events.

### 10.4 Backups

- [ ] PostgreSQL: Configure continuous WAL archiving to object storage (S3/MinIO). Schedule daily `pg_basebackup`.
- [ ] Test restore procedures monthly. Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective).
- [ ] Redis: Enable RDB snapshots in addition to AOF for point-in-time recovery.
- [ ] Elasticsearch: Configure snapshot repository (S3-compatible) with daily snapshots.
- [ ] MinIO: Enable bucket replication to a secondary site for disaster recovery.
- [ ] Kafka: Log retention (7 days default) provides inherent replay capability. For longer retention, configure tiered storage.

### 10.5 Monitoring and Observability

- [ ] Deploy Prometheus for metrics collection from all NestJS services (via `@willsoto/nestjs-prometheus` or custom `/metrics` endpoints).
- [ ] Deploy Grafana dashboards for:
  - Service health and latency (per-service, per-endpoint).
  - Kafka consumer lag, throughput, and broker health.
  - PostgreSQL connection pool utilization, query latency, replication lag.
  - Redis memory usage, hit rate, eviction count.
  - Elasticsearch cluster health, indexing rate, search latency.
- [ ] Deploy Loki for centralized log aggregation (structured JSON logs from all services).
- [ ] Configure alerting rules:
  - Service down (pod not ready for >2 minutes).
  - Kafka consumer lag > threshold (per topic).
  - Database connection pool exhaustion.
  - JWT key expiry approaching.
  - Disk usage > 80% on any persistent volume.
  - Error rate > 1% on any service endpoint.

### 10.6 Network Security

- [ ] Deploy services in private subnets; expose only the API gateway (Traefik) publicly.
- [ ] Configure Network Policies in Kubernetes to restrict pod-to-pod communication.
- [ ] Enable rate limiting at the API gateway level (Traefik middleware).
- [ ] Deploy a Web Application Firewall (WAF) in front of the API gateway.
- [ ] Restrict database and Redis access to service pods only (no public exposure).

### 10.7 Authentication and Authorization

- [ ] Enable MFA for all administrative roles (`SUPER_ADMIN`, `CONTINENTAL_ADMIN`, `REC_ADMIN`, `NATIONAL_ADMIN`).
- [ ] Configure rate limiting on `/auth/login` and `/auth/refresh` endpoints (prevent brute force).
- [ ] Implement account lockout after N failed attempts.
- [ ] Ensure `tenantId` is enforced in every query (no cross-tenant data leakage).
- [ ] Audit all authentication events (login, logout, token refresh, MFA challenges).

### 10.8 Data Protection

- [ ] Classify all data per the `DataClassification` enum (`PUBLIC`, `PARTNER`, `RESTRICTED`, `CONFIDENTIAL`).
- [ ] Encrypt `CONFIDENTIAL` data at rest (PostgreSQL column-level encryption or Vault transit).
- [ ] Ensure the audit log captures every mutation with actor, timestamp, reason, and data classification.
- [ ] Configure data retention policies per classification level.
- [ ] Implement GDPR-style data subject access and deletion capabilities where applicable.

### 10.9 CI/CD Pipeline

- [ ] GitHub Actions for build, test, lint on every PR.
- [ ] Integration tests with Testcontainers in CI (PostgreSQL, Kafka, Redis).
- [ ] Container image scanning (Trivy, Snyk) before pushing to registry.
- [ ] ArgoCD for GitOps-based deployment to Kubernetes clusters.
- [ ] Separate environments: `dev` -> `staging` -> `production` with promotion gates.
- [ ] Database migration safety: Run `prisma migrate deploy` (not `prisma migrate dev`) in CI/CD.

### 10.10 High Availability and Disaster Recovery

- [ ] Deploy across multiple availability zones (minimum 2 AZs).
- [ ] PostgreSQL: Primary + synchronous standby in separate AZs. Automated failover via Patroni or Cloud-managed HA.
- [ ] Kafka: Brokers distributed across AZs. `min.insync.replicas=2` ensures writes survive single-AZ failure.
- [ ] Redis: Sentinel or Cluster mode with replicas in separate AZs.
- [ ] Define and test DR runbooks: full-region failover, data restore, service recovery order.
- [ ] Document RTO and RPO targets per service tier.

---

## Appendix A: Full Docker Compose Architecture Diagram

```
                          +---------------------+
                          |     Traefik v3.0     |
                          |  :4000 (HTTP)        |
                          |  :4443 (HTTPS)       |
                          |  :8090 (Dashboard)   |
                          +---------+-----------+
                                    |
                     +--------------+--------------+
                     |              |              |
              +------+------+ +----+----+ +-------+------+
              | NestJS      | | Next.js | | Other        |
              | Services    | | Apps    | | Services     |
              | :3001-3033  | | :3000   | |              |
              +------+------+ +---------+ +--------------+
                     |
        +------------+------------+-----------+
        |            |            |           |
  +-----+-----+ +---+---+ +-----+----+ +----+-----+
  | PostgreSQL | | Redis | | Elastic  | | MinIO    |
  | + PostGIS  | | 7     | | Search   | |          |
  | :5432      | | :6379 | | :9200    | | :9000 API|
  +------------+ +-------+ +----------+ | :9001 UI |
                                         +----------+
        +------------+------------+
        |            |            |
  +-----+-----+ +---+-----+ +---+--------+
  | Kafka-1   | | Kafka-2 | | Kafka-3    |
  | :9092     | | :9094   | | :9096      |
  +-----------+ +---------+ +------------+
        |
  +-----+-----+    +------------------+
  | Kafka UI  |    | Schema Registry  |
  | :8080     |    | :8081            |
  +-----------+    +------------------+

  +------------+
  | Mailpit    |
  | :1025 SMTP |
  | :8025 Web  |
  +------------+
```

---

## Appendix B: Troubleshooting

### Kafka brokers not starting

If brokers fail to start with cluster ID errors, ensure all three brokers use the same `CLUSTER_ID` value (`MkU3OEVBNTcwNTJENDM2Qk`). If volumes contain data from a previous cluster, reset with:

```bash
pnpm docker:reset
```

### PostgreSQL init script not running

The init script only runs on first container creation (empty volume). To re-run:

```bash
docker compose down -v  # WARNING: destroys all data
docker compose up -d
```

### Port conflicts

If any port is already in use, modify the port mapping in `docker-compose.yml` and update the corresponding variable in `.env`.

### Elasticsearch heap errors

If Elasticsearch crashes with OOM, increase the JVM heap in `docker-compose.yml`:

```yaml
ES_JAVA_OPTS=-Xms1g -Xmx1g
```

Ensure your Docker daemon has sufficient memory allocated (16 GB recommended).

### Kafka topics not created

If the `kafka-init` container exits before topics are created, re-run:

```bash
pnpm kafka:topics
```

Check logs for errors:

```bash
docker logs aris-kafka-init
```
