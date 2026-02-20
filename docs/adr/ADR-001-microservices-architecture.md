# ADR-001: Microservices Architecture for ARIS 3.0

## Status

Accepted

## Date

2024-06-01

## Context

ARIS 3.0 is the continental digital infrastructure for the African Union's Inter-African Bureau for Animal Resources (AU-IBAR). The system must serve 55 Member States and 8 Regional Economic Communities (RECs) across 9 distinct business domains: Governance & Capacities, Animal Health & One Health, Production & Pastoralism, Trade Markets & SPS, Fisheries & Aquaculture, Wildlife & Biodiversity, Apiculture & Pollination, Climate & Environment, and Knowledge Management.

The architecture must support 22 backend services, each aligned to a bounded context within these domains. Development is distributed across 6 independent Claude Code instances (CC-1 through CC-6), each responsible for a distinct slice of the system: Platform Core, Data Hub, Collecte & Workflow, Domain Services, Frontend Web, and Mobile. These teams must be able to develop, test, and deploy independently without coordination bottlenecks.

The system has strict requirements around multi-tenant data isolation (AU-IBAR > REC > Member State hierarchy), federated data sovereignty (data produced and validated at country level), and interoperability with international systems (WAHIS, EMPRES, FAOSTAT, FishStatJ, CITES). Different domains have vastly different scaling profiles: Animal Health surveillance generates high-frequency event data during outbreaks, while Governance updates are infrequent. The platform must be production-grade from day one, supporting high availability, disaster recovery, and independent service scaling.

## Decision

We adopt a **microservices architecture** using NestJS 10 with TypeScript 5 (strict mode), with one service per bounded context. Each service owns its own PostgreSQL schema (managed via Prisma), communicates asynchronously through Apache Kafka, and is independently deployable via Docker containers orchestrated on Kubernetes.

The 22 services are organized into 5 clusters:

- **Platform (CC-1):** tenant, credential, message, drive, realtime
- **Data Hub (CC-2):** master-data, data-quality, data-contract, interop-hub
- **Collecte & Workflow (CC-3):** form-builder, collecte, workflow
- **Domain Services (CC-4):** animal-health, livestock-prod, fisheries, wildlife, apiculture, trade-sps, governance, climate-env, analytics, geo-services, knowledge-hub
- **Shared Packages (CC-1):** shared-types, kafka-client, auth-middleware, db-schemas, ui-components, quality-rules, test-utils

Each service follows a uniform internal pattern: Controller -> Service -> Repository (Prisma), with Kafka event publication and data quality validation as cross-cutting concerns. Shared libraries in `packages/` provide consistent behavior for authentication, messaging, and type safety across all services.

## Consequences

### Positive

- **Independent deployability:** Each service can be deployed, scaled, and rolled back without affecting others. An outbreak surge in Animal Health does not require scaling the Fisheries service.
- **Team autonomy:** The 6 Claude Code instances can work on their assigned services in parallel with clear ownership boundaries and no merge conflicts across service boundaries.
- **Technology flexibility:** Individual services can adopt domain-specific technologies (e.g., PostGIS for geo-services, Elasticsearch for knowledge-hub) without impacting the broader system.
- **Fault isolation:** A failure in the analytics service does not bring down data collection or WAHIS reporting workflows.
- **Domain alignment:** Each service maps cleanly to a bounded context, making the codebase navigable and the domain logic cohesive.
- **Scalability:** Services with high traffic (animal-health during outbreaks, collecte during campaigns) can scale horizontally independent of low-traffic services.

### Negative

- **Operational complexity:** 22 services require robust CI/CD pipelines, container orchestration, distributed tracing, centralized logging, and health monitoring. The Kubernetes and Terraform infrastructure is non-trivial.
- **Network overhead:** Inter-service communication introduces latency and requires careful handling of partial failures, retries, and circuit breakers.
- **Data consistency:** Without a shared database, maintaining consistency across services requires event-driven patterns (saga, outbox) rather than simple transactions.
- **Local development burden:** Running 22 services locally is resource-intensive. Docker Compose must be carefully configured to allow developers to run only the subset they need.
- **Shared library management:** The `packages/` directory must be versioned and maintained by CC-1, and breaking changes require coordination across all consuming services.

### Neutral

- **Learning curve:** NestJS provides strong conventions (modules, providers, guards) that reduce the variability between services, partially offsetting the complexity of a distributed system.
- **Monitoring investment:** Prometheus, Grafana, and Loki are required regardless of architecture style, but microservices demand more granular instrumentation.

## Alternatives Considered

### Monolith

A single NestJS application containing all 22 modules. Rejected because: (1) 6 independent teams would face constant merge conflicts in a single codebase, (2) scaling would be all-or-nothing, (3) a bug in one domain could bring down the entire system, and (4) deployment cycles would be coupled, slowing delivery across all 9 domains.

### Modular Monolith

A single deployable with strict module boundaries and database schema isolation. This was the strongest alternative. Rejected because: (1) the 6 Claude Code instances need true independent deployment to avoid coordination overhead, (2) the extreme variation in scaling requirements across domains (outbreak surges vs. static governance data) makes per-service scaling essential, and (3) the federated data sovereignty model maps more naturally to independent service databases.

### Serverless (AWS Lambda / Azure Functions)

Individual functions per endpoint, managed by cloud provider. Rejected because: (1) AU-IBAR requires infrastructure sovereignty and cannot depend on a single cloud vendor, (2) cold start latency is unacceptable for real-time outbreak alerting, (3) Kafka consumer groups require long-running processes, and (4) the on-premise/hybrid deployment model planned for Member State installations is incompatible with serverless platforms.
