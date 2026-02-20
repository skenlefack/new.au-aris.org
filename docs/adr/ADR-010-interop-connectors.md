# ADR-010: Interoperability Connector Architecture (WAHIS/EMPRES/FAOSTAT/FishStatJ/CITES)

## Status

Accepted

## Date

2024-06-01

## Context

ARIS operates within a dense ecosystem of international animal resource information systems. The
African Union's Member States are obligated to report to several international organizations:
WOAH (World Organisation for Animal Health) via the WAHIS platform, FAO via EMPRES-i for
emergency events and FAOSTAT for production statistics, and CITES for wildlife trade monitoring.
Currently, national focal points must manually re-enter data into each of these systems, leading
to duplicated effort, transcription errors, inconsistent reporting, and significant delays.

AU-IBAR's strategic mandate ("Report once, use many") requires ARIS to serve as the single point
of data entry for Member States, with automated or semi-automated export to all required
international systems. This is a core value proposition of the platform: reducing the reporting
burden on national veterinary services while improving data consistency and timeliness.

The interoperability challenge is non-trivial because each target system has different data formats,
submission protocols, authentication mechanisms, and update frequencies. WAHIS uses a structured
JSON/XML format with specific field mappings and codelist requirements. EMPRES expects near-real-time
signals with geographic context. FAOSTAT requires annual statistical submissions in standardized
CSV format. FishStatJ follows FAO's fisheries-specific species and area classifications. CITES
reporting involves trade permit data mapped to CITES appendices and species codes.

## Decision

We implement a dedicated `interop-hub` service (port 3032) using a modular connector architecture.
Each target system is encapsulated in a self-contained connector module with standardized
interfaces for data transformation, authentication, submission, and health monitoring.

### Connector Architecture

The interop-hub service contains 5 connector modules:

| Connector | Target System | Format | Trigger | Frequency |
|-----------|--------------|--------|---------|-----------|
| WAHIS | WOAH WAHIS 2.0 | WOAH_JSON, WOAH_XML | Kafka event after L2 approval | Near-real-time + 6-monthly + annual |
| EMPRES | FAO EMPRES-i | EMPRES_JSON | Kafka event after L2 approval | Near-real-time |
| FAOSTAT | FAO FAOSTAT | FAOSTAT_CSV, JSON | Scheduled + manual | Annual + updates |
| FishStatJ | FAO FishStatJ | CSV (FAO species/area codes) | Scheduled + manual | Annual |
| CITES_WDPA_GBIF | CITES, WDPA, GBIF | GeoJSON, REST API | Scheduled + manual | Quarterly |

### Connector Interface

Each connector module implements a standardized `InteropConnector` interface:

```typescript
interface InteropConnector {
  id: string;
  name: string;
  targetSystem: string;
  transform(records: DomainRecord[]): ExportPackage;
  validate(pkg: ExportPackage): ValidationResult;
  submit(pkg: ExportPackage): SubmissionResult;
  getHealth(): ConnectorHealth;
  getLastSync(): SyncStatus;
}
```

### Data Flow

1. **Event-Triggered Export (WAHIS, EMPRES)**: When a record passes L2 validation (NATIONAL_OFFICIAL
   approval), the workflow service publishes `au.workflow.wahis.ready.v1` or
   `au.workflow.empres.ready.v1` to Kafka. The interop-hub consumes these events and routes them
   to the appropriate connector.

2. **Scheduled Export (FAOSTAT, FishStatJ, CITES)**: A cron scheduler within the interop-hub
   triggers periodic data aggregation and export. FAOSTAT annual submissions aggregate the full
   year's production statistics. FishStatJ aggregates fisheries data by FAO species codes and
   statistical areas.

3. **Manual Export**: Authorized users (WAHIS_FOCAL_POINT, CONTINENTAL_ADMIN) can trigger exports
   on demand via the interop-hub REST API. This supports ad-hoc reporting and re-submission after
   corrections.

### Transformation Pipeline

Each connector's `transform` method implements a multi-step pipeline:

1. **Field Mapping**: Maps ARIS domain fields to target system fields using configurable mapping
   tables stored in the database. Mappings are versioned to handle target system schema changes.
2. **Code Translation**: Converts ARIS master-data codes to target system codelists (e.g., ARIS
   disease codes to WAHIS disease codes). Translation tables are maintained in the master-data
   service and cached in the interop-hub.
3. **Aggregation**: For statistical exports (FAOSTAT, FishStatJ), individual records are aggregated
   to the required granularity (national, annual).
4. **Format Serialization**: The mapped and aggregated data is serialized to the target format
   (JSON, XML, CSV, GeoJSON).
5. **Validation**: The serialized package is validated against the target system's schema before
   submission to catch format errors early.

### Export Package

Every export produces an `ExportPackage` record:

```
ExportPackage {
  id:              UUID
  connectorId:     String
  tenantId:        UUID
  format:          WOAH_JSON | WOAH_XML | EMPRES_JSON | FAOSTAT_CSV | FISHSTATJ_CSV | GEOJSON
  status:          PENDING | SUBMITTED | ACCEPTED | REJECTED | FAILED
  recordCount:     Number
  payload:         JSONB (serialized export data)
  submittedAt:     DateTime?
  responseCode:    String?
  responseBody:    String?
  errorDetails:    String?
  createdAt:       DateTime
  updatedAt:       DateTime
}
```

### Authentication and Security

Each connector manages its own authentication credentials for the target system:
- WAHIS: API key + OAuth2 client credentials (issued by WOAH to Member States).
- EMPRES: API token (issued by FAO).
- FAOSTAT/FishStatJ: Bulk upload via authenticated SFTP or REST API.
- CITES: REST API with institutional credentials.

Credentials are stored encrypted in the credential service (3002) and fetched at runtime. They are
never logged or included in Kafka event payloads. Each Member State maintains its own credentials
for systems that require country-level authentication (WAHIS, EMPRES).

### Health Monitoring

Each connector exposes health metrics consumed by Prometheus:
- `interop_connector_status{connector="wahis"}`: UP/DOWN/DEGRADED
- `interop_export_total{connector, status}`: Counter of export attempts by status.
- `interop_export_duration_seconds{connector}`: Histogram of export processing time.
- `interop_last_success_timestamp{connector}`: Gauge of last successful export.

A Grafana dashboard aggregates connector health across all tenants. Alerts fire when a connector
is DOWN for more than 1 hour or when export failure rate exceeds 10% over a rolling 24-hour window.

### Retry and Dead Letter Queue

Failed submissions are retried with exponential backoff (1min, 5min, 15min, 1h, 6h). After 5
failed attempts, the export package is moved to a Dead Letter Queue (DLQ) topic
(`sys.interop.dlq.v1`) and an alert is sent to the CONTINENTAL_ADMIN via the message service.
DLQ records can be manually retried or investigated via the admin panel.

### Kafka Events

The interop-hub publishes events for every export lifecycle stage:
- `au.interop.wahis.exported.v1` (successful WAHIS submission)
- `au.interop.empres.exported.v1` (successful EMPRES submission)
- `au.interop.faostat.exported.v1` (successful FAOSTAT submission)
- `au.interop.export.failed.v1` (any connector failure, includes error details)

## Consequences

### Positive

- "Report once, use many" is realized: Member States enter data once in ARIS and it flows
  automatically to all required international systems.
- Modular connector architecture allows adding new target systems without modifying existing
  connectors or the core interop-hub logic.
- Configurable field mappings and code translations handle target system schema evolution without
  code changes.
- Health monitoring and DLQ ensure no export is silently lost.
- Export packages are persisted with full audit trail, satisfying accountability requirements.

### Negative

- Dependency on external system APIs means connector reliability is bounded by the target system's
  availability and API stability.
- Maintaining code translation tables (ARIS codes to WAHIS/FAOSTAT/CITES codes) requires ongoing
  effort as international codelists evolve.
- Country-level WAHIS credentials must be provisioned and managed for each participating Member
  State, adding administrative overhead.
- The transformation pipeline adds latency between L2 approval and actual submission to the
  target system (typically seconds to minutes, but could be longer for large batch exports).

### Neutral

- The interop-hub is a centralized service, not embedded in domain services. This creates a single
  point of responsibility for all external integrations, which simplifies monitoring but means
  domain services cannot directly control their export logic.
- Export format specifications (WOAH JSON schema, FAOSTAT CSV template) are treated as external
  dependencies and versioned in the interop-hub's configuration, not in the shared-types package.

## Alternatives Considered

1. **Direct Service-to-Service Integration**: Each domain service (animal-health, fisheries, etc.)
   directly exports to its relevant international system. Rejected because it scatters
   interoperability logic across multiple services, makes credential management inconsistent,
   and complicates monitoring. The connector pattern centralizes this concern.
2. **API Gateway Pattern**: Use an API gateway (Kong, Tyk) to mediate between ARIS and external
   systems. Rejected because API gateways handle request routing and rate limiting but do not
   provide data transformation, aggregation, or format conversion, which are the core challenges
   of interoperability.
3. **ETL Tools (Airbyte, Fivetran)**: Use dedicated ETL/ELT platforms for data export. Rejected
   because these tools are optimized for data warehouse ingestion, not for submitting structured
   reports to domain-specific APIs with custom authentication and format requirements. They also
   introduce an external dependency that conflicts with the self-hosted infrastructure strategy.
4. **Message Queue Direct Push**: Publish WAHIS-formatted messages directly to WOAH's message
   queue. Rejected because most target systems (WAHIS, EMPRES, FAOSTAT) expose REST or SFTP
   interfaces, not message queues. The interop-hub adapts ARIS's event-driven architecture to
   the target system's preferred integration pattern.
