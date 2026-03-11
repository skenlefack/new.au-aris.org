# Analytics Service

**Port:** 3030
**Stack:** Fastify, ioredis, Kafka consumer subscriptions

## Description

CQRS Query-side reader for dashboards, KPIs, trends, and cross-domain correlations. This service does not own any database tables. It reads exclusively from Redis read models that are populated by Kafka consumers processing domain events from across the ARIS platform.

The service provides real-time aggregated analytics across all 9 ARIS business domains, including health surveillance KPIs, vaccination coverage denominators, quality gate metrics, workflow timeliness, cross-domain risk scores, and domain-specific aggregations (livestock, fisheries, trade, wildlife, climate, apiculture, governance).

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (liveness/readiness) |
| GET | `/api/v1/analytics/health/kpis` | Health KPIs (outbreaks, cases, deaths, coverage) |
| GET | `/api/v1/analytics/health/trends` | Health event trends over configurable period |
| GET | `/api/v1/analytics/quality/dashboard` | Data quality gate pass/fail rates |
| GET | `/api/v1/analytics/workflow/timeliness` | 4-level workflow approval timeliness |
| GET | `/api/v1/analytics/denominators` | Vaccination denominators (doses, target, coverage) |
| GET | `/api/v1/analytics/export/csv` | CSV export (health, vaccination, quality) |
| GET | `/api/v1/analytics/cross-domain/correlations` | Cross-domain correlation engine |
| GET | `/api/v1/analytics/cross-domain/risk-score` | Composite country risk score (6 domains) |
| GET | `/api/v1/analytics/livestock/population` | Livestock population by species |
| GET | `/api/v1/analytics/fisheries/catches` | Fisheries catches by species and method |
| GET | `/api/v1/analytics/trade/balance` | Trade balance (exports, imports, partners) |
| GET | `/api/v1/analytics/wildlife/crime-trends` | Wildlife crime trends by type and area |
| GET | `/api/v1/analytics/climate/alerts` | Climate/environment hotspot alerts |
| GET | `/api/v1/analytics/governance/pvs-scores` | Governance PVS evaluation scores |

All routes except `/health` require JWT authentication via the `authHookFn` pre-handler.

## Kafka Topics Consumed

The service subscribes to 14 Kafka topics via the `analytics-aggregator` consumer group:

| Topic | Handler |
|-------|---------|
| `ms.health.outbreak.created.v1` | `AggregationService.handleHealthEventCreated` |
| `ms.health.outbreak.confirmed.v1` | `AggregationService.handleHealthEventConfirmed` |
| `ms.health.vaccination.completed.v1` | `AggregationService.handleVaccinationCompleted` |
| `ms.health.lab-result.created.v1` | `AggregationService.handleLabResultCreated` |
| `au.quality.record.validated.v1` | `AggregationService.handleQualityValidated` |
| `au.quality.record.rejected.v1` | `AggregationService.handleQualityRejected` |
| `au.workflow.validation.approved.v1` | `AggregationService.handleWorkflowApproved` |
| `ms.livestock.census.created.v1` | `DomainAggregationService.handleLivestockCensusCreated` |
| `ms.fisheries.capture.recorded.v1` | `DomainAggregationService.handleFishCaptureRecorded` |
| `ms.wildlife.crime.reported.v1` | `DomainAggregationService.handleWildlifeCrimeReported` |
| `ms.trade.flow.created.v1` | `DomainAggregationService.handleTradeFlowCreated` |
| `ms.climate.hotspot.detected.v1` | `DomainAggregationService.handleClimateHotspotDetected` |
| `ms.apiculture.production.recorded.v1` | `DomainAggregationService.handleApicultureProductionRecorded` |
| `ms.governance.pvs.evaluated.v1` | `DomainAggregationService.handleGovernancePvsEvaluated` |

## Architecture

```
Kafka Topics (14)
      |
      v
Consumer Registry ──> AggregationService ──> Redis (health, vaccination, lab, quality, workflow)
                  └──> DomainAggregationService ──> Redis (livestock, fisheries, trade, wildlife, climate, apiculture, governance)

HTTP Routes
      |
      v
HealthKpiService ──────> Redis (read models)
CrossDomainService ────> Redis (correlations, risk scores)
```

## Services

- **AggregationService** -- Processes health, vaccination, lab, quality, and workflow events into Redis read models
- **HealthKpiService** -- Reads health KPIs, trends, quality dashboard, workflow timeliness, and denominators from Redis
- **CrossDomainService** -- Correlation engine and composite risk score calculator across 6 domains (health, climate, trade, wildlife, governance, livestock)
- **DomainAggregationService** -- Processes domain-specific events (livestock, fisheries, wildlife, trade, climate, apiculture, governance) into Redis

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANALYTICS_PORT` | `3030` | HTTP server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses (comma-separated) |
| `JWT_PUBLIC_KEY` | -- | RS256 public key for JWT validation |

## Dev Commands

```bash
# Start in development mode (hot reload)
pnpm dev

# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build for production
pnpm build

# Start production build
pnpm start
```
