# ADR-003: CQRS Pattern with Redis Read Models

## Status

Accepted

## Date

2024-06-01

## Context

ARIS 4.0 serves two fundamentally different access patterns across its 22 microservices:

1. **Write path (command):** Domain services (animal-health, livestock-prod, fisheries, etc.) receive data submissions from 55 Member States through web forms, mobile offline sync, and interoperability imports. These writes must enforce strict business rules, pass 8 data quality gates, traverse a 4-level validation workflow, and maintain full audit trail with version history. Write consistency and data integrity are paramount. The PostgreSQL + Prisma stack provides ACID transactions, referential integrity, and schema enforcement that the write path demands.

2. **Read path (query):** The analytics service, dashboards (Apache Superset, Metabase), the Next.js web application, and the mobile app need real-time aggregated KPIs, cross-domain summaries, and pre-computed views. Examples include: total confirmed outbreaks by REC this quarter, vaccination coverage percentages by species and country, trade flow volumes across border points, and fisheries capture trends. These reads span multiple services, require denormalized data for performance, and are accessed orders of magnitude more frequently than writes.

Attempting to serve both patterns from the same PostgreSQL schemas creates several problems: (1) complex cross-service JOIN queries violate service boundaries, (2) analytical queries compete with transactional writes for database resources, (3) real-time dashboards require sub-second response times that normalized relational schemas cannot deliver without heavy indexing that degrades write performance, and (4) the multi-tenant hierarchy (AU-IBAR sees all, REC sees its Member States) requires pre-computed aggregations at each level.

The system already uses Apache Kafka as its event bus (see ADR-002), providing a reliable stream of domain events from all services. This event stream is the natural foundation for materializing read-optimized views.

## Decision

We adopt the **Command Query Responsibility Segregation (CQRS)** pattern. The write side and read side are explicitly separated:

**Write side:**
- Each domain service writes to its own PostgreSQL database (one schema per service) via Prisma ORM.
- All mutations are validated through data quality gates (`@aris/quality-rules`), authorized via RBAC (`@aris/auth-middleware`), and scoped to a `tenantId`.
- Every write publishes a domain event to Kafka (e.g., `ms.health.outbreak.created.v1`).
- PostgreSQL remains the source of truth for all domain data.

**Read side:**
- Kafka consumers in the analytics service and other read-heavy services consume domain events and materialize denormalized read models in **Redis 7**.
- Read models are structured as Redis hashes, sorted sets, and JSON documents (using RedisJSON) optimized for specific query patterns.
- Examples of read models:
  - `kpi:outbreaks:confirmed:{tenantId}:{quarter}` -- outbreak count by tenant and period
  - `summary:vaccination:{tenantId}:{species}` -- vaccination coverage summary
  - `leaderboard:trade:{recId}:{year}` -- trade volume rankings within a REC
  - `timeseries:captures:{tenantId}` -- fisheries capture trend data
- Read models are rebuilt from Kafka events on demand (consumer restart replays from offset 0).
- The Next.js frontend and dashboards query Redis read models directly through a thin API layer, bypassing domain service databases entirely.

**Consistency model:**
- The system is **eventually consistent** between write and read sides. The typical propagation delay is sub-second (Kafka consumer lag). This is acceptable because: (1) dashboard users expect near-real-time, not strict real-time, (2) the 4-level validation workflow already introduces hours-to-days delay between submission and publication, and (3) the official WAHIS reporting track has its own distinct timeline.
- Each read model includes a `lastUpdatedAt` timestamp and a `sourceOffset` (Kafka offset) for transparency.

**We explicitly do not adopt full Event Sourcing** for domain services. Domain state is stored as current-state rows in PostgreSQL, not as event logs. The audit trail captures version history, but service logic reads current state from the database, not by replaying events. This avoids the complexity of event store management, snapshot strategies, and event schema evolution across 22 services.

## Consequences

### Positive

- **Read performance:** Redis delivers sub-millisecond reads for pre-computed KPIs and aggregations. Dashboard response times are consistently fast regardless of the underlying data volume.
- **Write isolation:** Domain services are not impacted by analytical query load. PostgreSQL resources are dedicated to transactional writes and data quality enforcement.
- **Flexible read models:** New read models can be added by deploying a new Kafka consumer without modifying any domain service. This supports the evolving dashboard and reporting requirements across 9 business domains.
- **Multi-tenant aggregation:** Read models can be pre-computed at each tenant level (Member State, REC, Continental), eliminating expensive runtime aggregation queries.
- **Rebuild capability:** If a read model becomes corrupted or a new model is needed, the Kafka consumer can replay events from the beginning of the topic to rebuild the Redis state from scratch.
- **Technology reuse:** Redis is already in the stack for session management and distributed locks. Using it for read models consolidates the caching layer rather than introducing a new technology.

### Negative

- **Eventual consistency:** Users may briefly see stale data after a write. This requires careful UX design: after a form submission, the web app should show optimistic updates or a "processing" indicator rather than immediately querying the read model.
- **Dual data management:** The team must maintain both Prisma schemas (write side) and Redis data structures (read side), along with the Kafka consumers that bridge them. This doubles the surface area for data-related bugs.
- **Redis memory pressure:** Pre-computed read models for 55 Member States across 9 domains consume significant memory. Redis memory must be monitored and eviction policies carefully configured (no eviction for read models; LRU only for cache entries).
- **Consumer lag monitoring:** If Kafka consumers fall behind (e.g., during a burst of outbreak reports), read models become stale. Prometheus alerts must be configured for consumer group lag exceeding acceptable thresholds.

### Neutral

- **No full event sourcing:** By choosing CQRS without event sourcing, we trade the ability to reconstruct any past state purely from events for the simplicity of current-state storage in PostgreSQL. The audit trail provides version history for compliance, which is sufficient for ARIS requirements.
- **Kafka dependency deepens:** This decision increases the system's reliance on Kafka as the backbone connecting write and read sides. This is consistent with ADR-002 and the overall event-driven architecture.

## Alternatives Considered

### Single Database with Materialized Views

Use PostgreSQL materialized views to pre-compute read-optimized queries. Rejected because: (1) materialized views in a microservices architecture require cross-database queries or a centralized analytics database, violating service boundaries, (2) refreshing materialized views locks the underlying tables, degrading write performance during refresh cycles, (3) materialized views cannot be incrementally updated in PostgreSQL (full refresh only), making them impractical for near-real-time dashboards, and (4) scaling reads requires scaling PostgreSQL vertically, which is more expensive than scaling Redis horizontally.

### Dedicated Analytics Database (Data Warehouse)

Route all events to a dedicated Trino or ClickHouse instance for analytical queries. This approach is partially adopted -- Trino is used for complex ad-hoc analytics and historical reporting. However, it was rejected as the primary read path because: (1) Trino query latency (seconds) is too high for real-time dashboard widgets, (2) maintaining a full data warehouse schema adds significant complexity, and (3) Redis provides the sub-millisecond response times needed for the web and mobile applications' interactive dashboards.

### OpenSearch as Read Model

Use OpenSearch 2 (already in the stack for full-text search) as the read model store. Rejected as the primary read model because: (1) OpenSearch is optimized for full-text search and document retrieval, not for numeric aggregations and time-series KPIs, (2) its eventual consistency model is less predictable than Redis (segment merges, refresh intervals), (3) memory consumption for numeric aggregation indices would be significantly higher than Redis hashes and sorted sets, and (4) OpenSearch is designated for the datalake search use case, and overloading it with KPI read models would complicate capacity planning. OpenSearch remains in the stack for document search, but Redis serves as the primary CQRS read model store.
