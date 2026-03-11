# ADR-002: Apache Kafka 3.7 KRaft as Event Bus

## Status

Accepted

## Date

2024-06-01

## Context

ARIS 4.0 adopts a microservices architecture (see ADR-001) with 22 services spanning 9 business domains. These services must communicate asynchronously to maintain loose coupling, support event replay for audit and debugging, and enable real-time data pipelines for analytics and interoperability exports. The system must handle several distinct messaging patterns:

1. **Domain event propagation:** When an outbreak is created in animal-health, data-quality must validate it, workflow must route it through 4-level approval, analytics must update KPIs, and interop-hub must prepare WAHIS/EMPRES exports.
2. **Audit trail:** Every mutation across all 55 Member States must be durably logged with full provenance, supporting regulatory compliance and dispute resolution. Events must be replayable to reconstruct the state of any record at any point in time.
3. **Cross-service data synchronization:** Master data changes (species taxonomy updates, administrative boundary changes) must propagate reliably to all consuming services.
4. **High-throughput ingestion:** During outbreak surges or data collection campaigns, the system must ingest thousands of events per second without backpressure causing data loss.
5. **Offline sync reconciliation:** Mobile field agents operating offline will sync batches of collected data, requiring ordered processing and exactly-once semantics to avoid duplicates.

The chosen message broker must support durable ordered logs, consumer groups for parallel processing, dead letter queues for failed messages, and topic-based routing with a structured naming convention (`{scope}.{domain}.{entity}.{action}.v{version}`).

## Decision

We adopt **Apache Kafka 3.7 in KRaft mode** (no ZooKeeper dependency) as the sole event bus for ARIS 4.0. The deployment topology is a 3-broker cluster with replication factor 3 and `min.insync.replicas=2`, ensuring no data loss if a single broker fails.

Key configuration decisions:

- **KRaft mode:** Kafka's built-in Raft consensus replaces ZooKeeper, reducing operational complexity from 6 nodes (3 ZK + 3 Kafka) to 3 combined controller/broker nodes.
- **Topic naming:** All topics follow the convention `{scope}.{domain}.{entity}.{action}.v{version}` (e.g., `ms.health.outbreak.created.v1`), enforced by the `@aris/kafka-client` shared library.
- **Partitioning:** Topics are partitioned by `tenantId` to ensure ordered processing per Member State and enable tenant-level parallelism.
- **Retention:** Domain event topics retain data for 90 days (configurable per topic). Audit topics retain indefinitely with tiered storage to object storage (MinIO).
- **Dead Letter Queues:** Every consumer group has an automatic DLQ topic (`*.dlq`) managed by the shared `@aris/kafka-client` package. Failed messages are retried 3 times with exponential backoff before routing to DLQ.
- **Schema management:** Event schemas are defined as TypeScript interfaces in `@aris/shared-types` and validated at both producer and consumer sides. Schema evolution follows backward-compatible rules (additive fields only, no field removal).
- **Client library:** The `@aris/kafka-client` package provides `KafkaProducerService` and `KafkaConsumerService` abstractions that handle serialization, error handling, DLQ routing, and observability (Prometheus metrics) uniformly across all 22 services.

## Consequences

### Positive

- **Durable ordered log:** Kafka's append-only log ensures events are never lost and can be replayed from any offset. This is critical for audit trail reconstruction and debugging production issues.
- **Consumer group parallelism:** Multiple instances of a service can consume from the same topic with automatic partition assignment, enabling horizontal scaling during outbreak surges.
- **Decoupled services:** Producers and consumers have no runtime dependency on each other. The animal-health service publishes an outbreak event without knowing which downstream services consume it.
- **Replay capability:** New services (e.g., a future analytics pipeline) can consume historical events from the beginning of a topic, bootstrapping their state without requiring backfill scripts.
- **Exactly-once semantics:** Kafka's transactional producer and idempotent consumer support prevent duplicate processing during offline sync reconciliation.
- **KRaft simplification:** Eliminating ZooKeeper reduces the operational footprint, simplifies monitoring, and removes a historically fragile component from the infrastructure.

### Negative

- **Operational expertise:** Kafka requires specialized knowledge for broker tuning, partition rebalancing, and disaster recovery. The infrastructure team must invest in Kafka-specific training.
- **Resource consumption:** A 3-broker Kafka cluster requires significant memory (minimum 6 GB heap per broker) and disk I/O. This is a heavier footprint than alternatives like RabbitMQ or Redis Streams.
- **Complexity for simple cases:** Some service-to-service interactions (e.g., credential service verifying tenant existence) are simple request-response patterns that would be more naturally served by synchronous HTTP calls. We mitigate this by allowing synchronous calls for queries while reserving Kafka for commands and events.
- **Local development weight:** Running a 3-broker Kafka cluster in Docker Compose is resource-intensive. For local development, a single-broker configuration is provided, with the understanding that partition rebalancing behavior differs.

### Neutral

- **Monitoring integration:** Kafka exposes JMX metrics that are scraped by Prometheus via the JMX Exporter agent. This adds one more monitoring target per broker but integrates cleanly with the existing Grafana dashboard infrastructure.
- **Topic proliferation:** With 22 services and the structured naming convention, the system will have 100+ topics. This is normal for Kafka deployments at this scale and is managed through automated topic creation in the `@aris/kafka-client` library.

## Alternatives Considered

### RabbitMQ

A mature message broker with excellent routing capabilities (exchanges, bindings, queues). Rejected because: (1) RabbitMQ is optimized for transient message delivery, not durable event logs -- messages are deleted after acknowledgment, making replay impossible without additional infrastructure, (2) it lacks native log compaction, which is needed for master data change streams, (3) consumer scaling requires manual queue sharding rather than Kafka's automatic partition assignment, and (4) the AMQP protocol adds complexity for the mobile offline sync use case.

### Redis Streams

Redis 7 includes a Streams data structure that provides append-only log semantics similar to Kafka. Rejected because: (1) Redis Streams lack mature consumer group rebalancing and exactly-once semantics, (2) Redis is already designated for caching and CQRS read models (see ADR-003), and overloading it with event bus duties creates a single point of failure, (3) durability guarantees are weaker (RDB/AOF persistence vs. Kafka's replicated log), and (4) the ecosystem of monitoring and management tools for Redis Streams is less mature than Kafka.

### AWS SNS/SQS

Amazon's managed pub/sub and queue services. Rejected because: (1) AU-IBAR requires infrastructure sovereignty and cannot depend on a single cloud vendor, (2) SNS/SQS do not provide ordered delivery guarantees within a partition, (3) there is no replay capability (messages are deleted after processing), and (4) the on-premise deployment model for Member State installations is incompatible with AWS-managed services.

### NATS / NATS JetStream

A lightweight, high-performance messaging system with JetStream providing persistence. Rejected because: (1) the NATS ecosystem is less mature for production deployments at this scale, (2) Kafka Streams (used by the analytics service) has no NATS equivalent, requiring a separate stream processing framework, (3) community support and operational tooling (monitoring, management UIs) are significantly less developed than Kafka, and (4) the team has existing Kafka expertise from prior AU-IBAR projects.
